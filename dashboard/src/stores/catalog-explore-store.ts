/**
 * Catalog explore store — SQL editor state for ad-hoc catalog queries.
 *
 * Manages a SQL Gateway session, submits user SQL, and streams result rows with
 * paginated polling. Rows are accumulated up to {@link MAX_ROWS}. Supports
 * session recovery on expiration and cooperative cancellation.
 *
 * Two execution modes share one session:
 *   - `executeQuery()` — single statement (legacy `/catalogs/explore` page);
 *     writes the flat `columns`/`rows`/`status` fields directly.
 *   - `executeAll()` / `executeSelection()` — multi-statement console
 *     (`/hub/sql-explorer`); splits the script, runs statements sequentially in
 *     one session, and records one {@link StatementResult} per statement.
 *
 * The flat `columns`/`rows`/`error` fields always mirror the active statement, so
 * single-result consumers keep working regardless of which mode ran.
 *
 * @module catalog-explore-store
 */

import { create } from "zustand"
import {
  cancelJob,
  createSQLSession,
  fetchSQLResults,
  submitSQLStatement,
} from "@/lib/graphql-api-client"
import { splitStatements } from "@/stores/sql-gateway-store"

/** Default cap on rows accumulated (per statement) before a query is auto-stopped.
 *  Overridable at runtime via the `maxRows` store field. */
const MAX_ROWS = 10_000
/** Pause between result polls while the gateway computes (NOT_READY) results. */
const POLL_DELAY_MS = 200

/** Lifecycle status of a catalog explore query or a single statement. */
type ExploreStatus =
  | "idle"
  | "submitting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

/** Result of one executed statement in a multi-statement run. */
export interface StatementResult {
  /** Zero-based position in the executed script. */
  index: number
  /** The statement text (without its trailing `;`). */
  sql: string
  /** Lifecycle status of this statement. */
  status: ExploreStatus
  /** Column metadata from the first result batch. */
  columns: Array<{ name: string; dataType: string }>
  /** Accumulated result rows (up to MAX_ROWS). */
  rows: Array<Array<string | null>>
  /** Number of accumulated rows. */
  rowCount: number
  /** Wall-clock execution time in milliseconds, or null while running. */
  durationMs: number | null
  /** Flink job id when this statement launched a job; null otherwise. */
  jobId: string | null
  /** Error message when status is "failed". */
  error: string | null
}

/**
 * Flink Table/SQL runtime mode. `AUTOMATIC` is intentionally excluded: the SQL
 * planner rejects it (it is a DataStream-API-only value) and accepts only these
 * two. Bounded sources (e.g. JDBC) want BATCH — required for full sorts and
 * non-windowed aggregations; unbounded sources (e.g. Kafka) want STREAMING.
 * See {@link applyRuntimeMode}.
 */
export type RuntimeMode = "STREAMING" | "BATCH"

/**
 * Idle-state retention for streaming queries (`table.exec.state.ttl`). Streaming
 * aggregations/joins retain keyed state indefinitely by default; a TTL bounds
 * that growth by expiring state left untouched for the given duration. `"off"`
 * is the sentinel for "don't set it" (Flink's default — no expiry); the others
 * are Flink duration strings sent verbatim. No effect in BATCH mode.
 */
export type StateTtl = "off" | "1 h" | "6 h" | "24 h"

interface ExploreState {
  /** Selected Flink runtime mode, applied to the session before each run. */
  runtimeMode: RuntimeMode
  /** Max rows accumulated per statement before auto-stopping (client-side cap). */
  maxRows: number
  /** Idle-state retention applied to streaming queries, or "off" (Flink default). */
  stateTtl: StateTtl
  /** Active SQL Gateway session handle, or null if no session. */
  sessionHandle: string | null
  /** Flink job id of the in-flight statement (if it launched one), for cancellation. */
  activeJobId: string | null
  /** Current SQL text in the editor. */
  sql: string
  /** Lifecycle status of the current query / overall run. */
  status: ExploreStatus
  /** Column metadata — mirrors the active statement. */
  columns: Array<{ name: string; dataType: string }>
  /** Result rows — mirror the active statement. */
  rows: Array<Array<string | null>>
  /** True while result polling is active. */
  streaming: boolean
  /** Error message — mirrors the active statement / most recent failure. */
  error: string | null
  /** Cooperative cancellation flag checked between poll iterations. */
  cancelled: boolean
  /** Per-statement results from the most recent multi-statement run. */
  statements: StatementResult[]
  /** Index of the statement whose result is currently surfaced. */
  activeIndex: number
}

interface ExploreActions {
  /** Update the SQL text in the editor. */
  setSql: (sql: string) => void
  /** Set the Flink runtime mode applied to the session before each run. */
  setRuntimeMode: (mode: RuntimeMode) => void
  /** Set the per-statement row cap. */
  setMaxRows: (rows: number) => void
  /** Set the idle-state retention applied to streaming queries. */
  setStateTtl: (ttl: StateTtl) => void
  /** Submit the current SQL as a single statement (legacy explore page). */
  executeQuery: () => Promise<void>
  /** Split the current SQL and run every statement sequentially. */
  executeAll: () => Promise<void>
  /** Run the provided text (one or more statements) sequentially. */
  executeSelection: (text: string) => Promise<void>
  /** Surface a different statement's result (drives the flat fields). */
  setActiveStatement: (index: number) => void
  /** Signal cooperative cancellation of the running query. */
  cancelQuery: () => void
  /** Clear all results and reset to idle state. */
  clearResults: () => void
}

export type CatalogExploreStore = ExploreState & ExploreActions

type SetState = (partial: Partial<CatalogExploreStore>) => void
type GetState = () => CatalogExploreStore

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Tag the Flink job launched by a statement so it's identifiable in the jobs list. */
async function tagPipelineName(session: string, sql: string): Promise<void> {
  const flat = sql.replace(/\s+/g, " ").trim()
  const truncated = flat.length > 80 ? `${flat.slice(0, 80)}...` : flat
  try {
    await submitSQLStatement(
      session,
      `SET 'pipeline.name' = 'explore: ${truncated.replaceAll("'", "''")}'`,
    )
  } catch {
    // SET may be unsupported on some gateway versions — continue anyway.
  }
}

/**
 * Build the session-level `SET` statements for the current execution config.
 * Runtime mode is always pinned — the Table/SQL planner needs an explicit BATCH
 * or STREAMING before any statement is planned (it rejects AUTOMATIC). State TTL
 * is pinned only when enabled; it bounds keyed-state growth for long-running
 * streaming aggregations/joins and is a no-op in batch.
 */
function sessionConfigStatements(cfg: {
  runtimeMode: RuntimeMode
  stateTtl: StateTtl
}): string[] {
  const stmts = [`SET 'execution.runtime-mode' = '${cfg.runtimeMode}'`]
  if (cfg.stateTtl !== "off") {
    stmts.push(`SET 'table.exec.state.ttl' = '${cfg.stateTtl}'`)
  }
  return stmts
}

/**
 * Apply session-level config via best-effort `SET`s ahead of the user's
 * statements. Idempotent — safe to re-issue each run and after session recovery.
 */
async function applySessionConfig(
  session: string,
  cfg: { runtimeMode: RuntimeMode; stateTtl: StateTtl },
): Promise<void> {
  for (const stmt of sessionConfigStatements(cfg)) {
    try {
      await submitSQLStatement(session, stmt)
    } catch {
      // SET may be unsupported on some gateway versions — continue anyway.
    }
  }
}

/** Live-progress callbacks for a single statement run. */
interface RunCallbacks {
  /** Fired once, when the statement's Flink job id is first observed. */
  onJob?: (jobId: string) => void
  /** Fired after each poll that may have added rows — drives live result display. */
  onProgress?: (snapshot: {
    columns: StatementResult["columns"]
    rows: StatementResult["rows"]
  }) => void
}

/**
 * Run one statement to completion against an existing session, accumulating
 * rows up to `maxRows`. Resolves with a terminal {@link StatementResult} — it
 * never throws; submission/fetch failures map to a "failed" result. The optional
 * callbacks stream intermediate progress (rows so far, job id) to the caller.
 */
async function runStatement(
  session: string,
  index: number,
  sql: string,
  isCancelled: () => boolean,
  maxRows: number,
  cb: RunCallbacks = {},
): Promise<StatementResult> {
  const started = performance.now()
  const base: StatementResult = {
    index,
    sql,
    status: "running",
    columns: [],
    rows: [],
    rowCount: 0,
    durationMs: null,
    jobId: null,
    error: null,
  }
  const elapsed = () => performance.now() - started

  await tagPipelineName(session, sql)

  let operationHandle: string
  try {
    operationHandle = await submitSQLStatement(session, sql)
  } catch (err) {
    return {
      ...base,
      status: "failed",
      durationMs: elapsed(),
      error: err instanceof Error ? err.message : "Submit failed",
    }
  }

  let token: string | undefined
  let columns: StatementResult["columns"] = []
  let rows: StatementResult["rows"] = []
  let jobId: string | null = null

  while (true) {
    if (isCancelled()) {
      return {
        ...base,
        status: "cancelled",
        columns,
        rows,
        rowCount: rows.length,
        durationMs: elapsed(),
        jobId,
      }
    }

    let result: Awaited<ReturnType<typeof fetchSQLResults>>
    try {
      result = await fetchSQLResults(session, operationHandle, token)
    } catch (err) {
      return {
        ...base,
        status: "failed",
        columns,
        rows,
        rowCount: rows.length,
        durationMs: elapsed(),
        jobId,
        error: err instanceof Error ? err.message : "Query failed",
      }
    }

    if (result.jobID && !jobId) {
      jobId = result.jobID
      cb.onJob?.(jobId)
    }
    let changed = false
    if (columns.length === 0 && result.columns.length > 0) {
      columns = result.columns
      changed = true
    }
    if (result.rows.length > 0 && rows.length < maxRows) {
      rows = [...rows, ...result.rows.slice(0, maxRows - rows.length)]
      changed = true
    }
    // Push a live snapshot only when something changed, so a slow stream
    // returning empty pages doesn't re-render the result table every poll.
    if (changed) cb.onProgress?.({ columns, rows })

    if (rows.length >= maxRows || !result.hasMore) {
      // Hit the row cap while the source still had more → the (streaming) job
      // keeps running but we won't consume further, so cancel it to avoid an
      // orphaned job. Only row-producing SELECTs reach this branch with a job id;
      // an INSERT returns no paginated rows, so its deployment is never cancelled.
      if (jobId && rows.length >= maxRows && result.hasMore) {
        void cancelJob(jobId).catch(() => {})
      }
      return {
        ...base,
        status: "completed",
        columns,
        rows,
        rowCount: rows.length,
        durationMs: elapsed(),
        jobId,
      }
    }

    token = result.nextToken ?? undefined
    await sleep(POLL_DELAY_MS)
  }
}

/** Surface a statement result through the flat (legacy) store fields. */
function mirror(set: SetState, r: StatementResult | undefined): void {
  if (!r) return
  set({ columns: r.columns, rows: r.rows, error: r.error })
}

/** Orchestrate a sequential multi-statement run, updating the store as it goes. */
async function runStatements(
  set: SetState,
  get: GetState,
  statements: string[],
): Promise<void> {
  if (statements.length === 0) return

  // Cancel any in-flight run before starting a new one.
  if (get().status === "running" || get().status === "submitting") {
    set({ cancelled: true })
  }

  const results: StatementResult[] = statements.map((sql, index) => ({
    index,
    sql,
    status: "idle",
    columns: [],
    rows: [],
    rowCount: 0,
    durationMs: null,
    jobId: null,
    error: null,
  }))

  set({
    status: "submitting",
    statements: [...results],
    activeIndex: 0,
    columns: [],
    rows: [],
    error: null,
    streaming: false,
    cancelled: false,
    activeJobId: null,
  })

  // Get or create the session (one recovery attempt on failure).
  let session = get().sessionHandle
  try {
    if (!session) {
      session = await createSQLSession()
      set({ sessionHandle: session })
    }
  } catch (err) {
    set({
      status: "failed",
      error: err instanceof Error ? err.message : "Could not open SQL session",
    })
    return
  }

  set({ status: "running", streaming: true })
  await applySessionConfig(session, get())
  const isCancelled = () => get().cancelled

  for (let i = 0; i < statements.length; i++) {
    if (isCancelled()) {
      results[i] = { ...results[i], status: "cancelled" }
      set({
        statements: [...results],
        activeIndex: i,
        status: "cancelled",
        streaming: false,
      })
      return
    }

    results[i] = { ...results[i], status: "running" }
    set({ statements: [...results], activeIndex: i })

    // Stream intermediate progress into the current statement + flat fields so
    // results tick in live rather than appearing only when the statement ends.
    const cb: RunCallbacks = {
      onJob: (jobId) => {
        results[i] = { ...results[i], jobId }
        set({ statements: [...results], activeJobId: jobId })
      },
      onProgress: ({ columns, rows }) => {
        results[i] = { ...results[i], columns, rows, rowCount: rows.length }
        set({ statements: [...results], columns, rows })
      },
    }

    let res = await runStatement(
      session,
      i,
      statements[i],
      isCancelled,
      get().maxRows,
      cb,
    )

    // One transparent recovery if the session expired mid-run.
    if (
      res.status === "failed" &&
      /session|404|not found/i.test(res.error ?? "")
    ) {
      try {
        session = await createSQLSession()
        set({ sessionHandle: session })
        await applySessionConfig(session, get())
        res = await runStatement(
          session,
          i,
          statements[i],
          isCancelled,
          get().maxRows,
          cb,
        )
      } catch {
        // Keep the original failure.
      }
    }

    results[i] = res
    set({ statements: [...results], activeIndex: i })
    mirror(set, res)

    if (res.status === "failed") {
      set({ status: "failed", streaming: false, error: res.error })
      return
    }
    if (res.status === "cancelled") {
      set({ status: "cancelled", streaming: false })
      return
    }
  }

  set({ status: get().cancelled ? "cancelled" : "completed", streaming: false })
}

export const useCatalogExploreStore = create<CatalogExploreStore>(
  (set, get) => ({
    runtimeMode: "STREAMING",
    maxRows: MAX_ROWS,
    stateTtl: "off",
    sessionHandle: null,
    activeJobId: null,
    sql: "",
    status: "idle",
    columns: [],
    rows: [],
    streaming: false,
    error: null,
    cancelled: false,
    statements: [],
    activeIndex: 0,

    setSql: (sql: string) => set({ sql }),
    setRuntimeMode: (runtimeMode) => set({ runtimeMode }),
    setMaxRows: (maxRows) => set({ maxRows }),
    setStateTtl: (stateTtl) => set({ stateTtl }),

    executeQuery: async () => {
      const { sql } = get()
      if (!sql.trim()) return

      // Cancel any running query
      if (get().status === "running" || get().status === "submitting") {
        set({ cancelled: true })
      }

      set({
        status: "submitting",
        columns: [],
        rows: [],
        error: null,
        streaming: false,
        cancelled: false,
        statements: [],
        activeIndex: 0,
        activeJobId: null,
      })

      // Get or create the session (one recovery attempt on expiry below).
      let session = get().sessionHandle
      try {
        if (!session) {
          session = await createSQLSession()
          set({ sessionHandle: session })
        }
      } catch (err) {
        set({
          status: "failed",
          error:
            err instanceof Error ? err.message : "Could not open SQL session",
        })
        return
      }
      await applySessionConfig(session, get())

      set({ status: "running", streaming: true })
      const isCancelled = () => get().cancelled
      // Same run loop as the multi-statement console — parity by construction:
      // live row streaming + job-id capture for true cancellation.
      const cb: RunCallbacks = {
        onJob: (jobId) => set({ activeJobId: jobId }),
        onProgress: ({ columns, rows }) => set({ columns, rows }),
      }

      let res = await runStatement(
        session,
        0,
        sql,
        isCancelled,
        get().maxRows,
        cb,
      )

      // One transparent recovery if the session expired mid-run.
      if (
        res.status === "failed" &&
        /session|404|not found/i.test(res.error ?? "")
      ) {
        try {
          session = await createSQLSession()
          set({ sessionHandle: session })
          await applySessionConfig(session, get())
          res = await runStatement(
            session,
            0,
            sql,
            isCancelled,
            get().maxRows,
            cb,
          )
        } catch {
          // Keep the original failure.
        }
      }

      set({
        activeJobId: null,
        columns: res.columns,
        rows: res.rows,
        error: res.error,
        streaming: false,
        status: res.status,
      })
    },

    executeAll: async () => {
      await runStatements(set, get, splitStatements(get().sql))
    },

    executeSelection: async (text: string) => {
      await runStatements(set, get, splitStatements(text))
    },

    setActiveStatement: (index: number) => {
      const s = get().statements[index]
      if (!s) return
      set({ activeIndex: index })
      mirror(set, s)
    },

    cancelQuery: () => {
      const { activeJobId } = get()
      // Stop the client loop immediately, then cancel the Flink job so a
      // streaming query doesn't keep running on the cluster after we stop polling.
      set({ cancelled: true, status: "cancelled", streaming: false })
      if (activeJobId) {
        void cancelJob(activeJobId).catch(() => {
          // Best-effort — the cooperative flag already halted client polling.
        })
      }
    },

    clearResults: () => {
      set({
        status: "idle",
        columns: [],
        rows: [],
        error: null,
        streaming: false,
        cancelled: false,
        statements: [],
        activeIndex: 0,
        activeJobId: null,
      })
    },
  }),
)
