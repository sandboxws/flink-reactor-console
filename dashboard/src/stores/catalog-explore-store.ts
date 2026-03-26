/**
 * Catalog explore store — SQL editor state for ad-hoc catalog queries.
 *
 * Manages a SQL Gateway session, submits user SQL, and streams result rows
 * with paginated polling. Rows are accumulated up to {@link MAX_ROWS}. Supports
 * session recovery on expiration and cooperative cancellation.
 *
 * @module catalog-explore-store
 */

import { create } from "zustand"
import {
  createSQLSession,
  fetchSQLResults,
  submitSQLStatement,
} from "@/lib/graphql-api-client"

/** Maximum rows accumulated before the query is auto-stopped. */
const MAX_ROWS = 10_000

/** Lifecycle status of a catalog explore query. */
type ExploreStatus =
  | "idle"
  | "submitting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

interface ExploreState {
  /** Active SQL Gateway session handle, or null if no session. */
  sessionHandle: string | null
  /** Current SQL text in the editor. */
  sql: string
  /** Lifecycle status of the current query. */
  status: ExploreStatus
  /** Column metadata from the first result batch. */
  columns: Array<{ name: string; dataType: string }>
  /** Accumulated result rows (up to MAX_ROWS). */
  rows: Array<Array<string | null>>
  /** True while result polling is active. */
  streaming: boolean
  /** Error message from the most recent failed query. */
  error: string | null
  /** Cooperative cancellation flag checked between poll iterations. */
  cancelled: boolean
}

interface ExploreActions {
  /** Update the SQL text in the editor. */
  setSql: (sql: string) => void
  /** Submit the current SQL for execution and begin streaming results. */
  executeQuery: () => Promise<void>
  /** Signal cooperative cancellation of the running query. */
  cancelQuery: () => void
  /** Clear all results and reset to idle state. */
  clearResults: () => void
}

export type CatalogExploreStore = ExploreState & ExploreActions

export const useCatalogExploreStore = create<CatalogExploreStore>(
  (set, get) => ({
    sessionHandle: null,
    sql: "",
    status: "idle",
    columns: [],
    rows: [],
    streaming: false,
    error: null,
    cancelled: false,

    setSql: (sql: string) => set({ sql }),

    executeQuery: async () => {
      const { sql, sessionHandle: existingSession } = get()
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
      })

      try {
        // Get or create session
        let session = existingSession
        if (!session) {
          session = await createSQLSession()
          set({ sessionHandle: session })
        }

        // Tag the job with the explore prefix (strip newlines for SQL string literal)
        const flatSql = sql.replace(/\s+/g, " ").trim()
        const truncatedSql =
          flatSql.length > 80 ? `${flatSql.slice(0, 80)}...` : flatSql
        const pipelineName = `explore: ${truncatedSql}`
        // Configure session: automatic runtime mode lets Flink pick batch vs
        // streaming based on source boundedness (e.g. JDBC → batch, Kafka → streaming).
        const sessionSetStatements = [
          `SET 'execution.runtime-mode' = 'AUTOMATIC'`,
          `SET 'pipeline.name' = '${pipelineName.replaceAll("'", "''")}'`,
        ]
        for (const stmt of sessionSetStatements) {
          try {
            await submitSQLStatement(session, stmt)
          } catch {
            // SET may fail on some SQL Gateway versions; continue anyway
          }
        }

        // Submit the actual statement
        let operationHandle: string
        try {
          operationHandle = await submitSQLStatement(session, sql)
        } catch (err) {
          // Session may have expired — try creating a new one
          if (
            err instanceof Error &&
            (err.message.includes("404") ||
              err.message.includes("not found") ||
              err.message.includes("Session"))
          ) {
            session = await createSQLSession()
            set({ sessionHandle: session })

            // Re-configure session after recovery
            for (const stmt of sessionSetStatements) {
              try {
                await submitSQLStatement(session, stmt)
              } catch {
                // Ignore SET failures
              }
            }

            operationHandle = await submitSQLStatement(session, sql)
          } else {
            throw err
          }
        }

        set({ status: "running", streaming: true })

        // Poll results
        let token: string | undefined
        let allRows: Array<Array<string | null>> = []
        const POLL_DELAY_MS = 200

        while (true) {
          if (get().cancelled) {
            set({ status: "cancelled", streaming: false })
            return
          }

          const result = await fetchSQLResults(session, operationHandle, token)

          // Set columns from first batch
          if (get().columns.length === 0 && result.columns.length > 0) {
            set({ columns: result.columns })
          }

          // Accumulate rows up to cap
          if (result.rows.length > 0) {
            const remaining = MAX_ROWS - allRows.length
            if (remaining > 0) {
              const batch = result.rows.slice(0, remaining)
              allRows = [...allRows, ...batch]
              set({ rows: allRows })
            }

            if (allRows.length >= MAX_ROWS) {
              set({ status: "completed", streaming: false })
              return
            }
          }

          if (!result.hasMore) {
            set({ status: "completed", streaming: false })
            return
          }

          token = result.nextToken ?? undefined

          // Brief pause between polls to avoid hammering the gateway
          // while results are being computed (NOT_READY state).
          await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS))
        }
      } catch (err) {
        set({
          status: "failed",
          streaming: false,
          error: err instanceof Error ? err.message : "Query failed",
        })
      }
    },

    cancelQuery: () => {
      set({ cancelled: true, status: "cancelled", streaming: false })
    },

    clearResults: () => {
      set({
        status: "idle",
        columns: [],
        rows: [],
        error: null,
        streaming: false,
        cancelled: false,
      })
    },
  }),
)
