import { create } from "zustand"

// ---------------------------------------------------------------------------
// SQL Gateway Store — manages active SQL Gateway tap observation sessions
// ---------------------------------------------------------------------------

/** Column metadata from SQL Gateway result set */
export interface ColumnInfo {
  columnName: string
  dataType: string
  nullable: boolean
}

export interface ActiveTapSession {
  sessionHandle: string
  operationHandle: string
  tapNodeId: string
  tapName: string
  status: "connecting" | "streaming" | "paused" | "error" | "closed"
  columns: ColumnInfo[]
  error?: string
  /** Last successfully consumed result token (0 = first page from startTap, 1+ = polling) */
  currentResultToken: number
}

/** First result page data returned by startTap */
export interface FirstPageResult {
  columns: ColumnInfo[]
  rows: Array<{ kind: string; fields: unknown[] }>
}

interface SqlGatewayState {
  /** Active tap sessions keyed by tapNodeId */
  sessions: Record<string, ActiveTapSession>

  /** Start a tap observation session — opens session, submits SQL, transitions to streaming.
   *  Returns the first result page (columns + any initial rows) so the caller
   *  can feed them to the store and start polling from token 1. */
  startTap: (
    tapNodeId: string,
    tapName: string,
    observationSql: string,
  ) => Promise<FirstPageResult | null>

  /** Pause result fetching for a session (consumer stops polling) */
  pauseTap: (tapNodeId: string) => void

  /** Resume result fetching for a paused session */
  resumeTap: (tapNodeId: string) => void

  /** Stop and close a tap session */
  stopTap: (tapNodeId: string) => Promise<void>

  /** Update the current result token for a session (used by polling loop) */
  updateResultToken: (tapNodeId: string, token: number) => void

  /** Stop all active sessions (used on page unmount) */
  stopAll: () => Promise<void>
}

/** API route base path for SQL Gateway proxy (via Go server) */
const SQL_GATEWAY_API = `${(import.meta.env.VITE_GRAPHQL_URL ?? "").replace("/graphql", "")}/api/flink/sql-gateway`

async function apiRequest<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${SQL_GATEWAY_API}/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string
      errors?: string[]
    }
    // SQL Gateway returns { errors: ["..."] } (plural array)
    const message =
      err.errors?.[0] ?? err.error ?? `SQL Gateway error: ${res.status}`
    throw new Error(message)
  }

  // DELETE may return empty body
  if (res.status === 204 || method === "DELETE") {
    return undefined as T
  }

  return (await res.json()) as T
}

/**
 * Split observation SQL into individual statements.
 * Observation SQL has a predictable format: CREATE TEMPORARY TABLE ...; SELECT * FROM ...;
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  for (const line of sql.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("--")) continue
    current += `${line}\n`
    if (trimmed.endsWith(";")) {
      const stmt = current.trim().replace(/;$/, "").trim()
      if (stmt) statements.push(stmt)
      current = ""
    }
  }
  const remaining = current.trim().replace(/;$/, "").trim()
  if (remaining) statements.push(remaining)
  return statements
}

/**
 * Fetch the actual error message from a failed SQL Gateway operation.
 * The SQL Gateway returns errors in the result endpoint's `errors` field
 * when an operation has failed.
 */
async function fetchOperationError(
  sessionHandle: string,
  operationHandle: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${SQL_GATEWAY_API}/v1/sessions/${sessionHandle}/operations/${operationHandle}/result/0`,
    )
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        errors?: string[]
        error?: string
      }
      return err.errors?.[0] ?? err.error ?? null
    }
    return null
  } catch {
    return null
  }
}

export const useSqlGatewayStore = create<SqlGatewayState>((set, get) => ({
  sessions: {},

  startTap: async (tapNodeId, tapName, observationSql) => {
    // Cleanup guard: if an existing session has a valid handle, tear it down first
    const existing = get().sessions[tapNodeId]
    if (existing?.sessionHandle) {
      if (
        existing.operationHandle &&
        (existing.status === "streaming" || existing.status === "paused")
      ) {
        await apiRequest(
          `v1/sessions/${existing.sessionHandle}/operations/${existing.operationHandle}/cancel`,
          "POST",
        ).catch(() => {})
      }
      await apiRequest(`v1/sessions/${existing.sessionHandle}`, "DELETE").catch(
        () => {},
      )
      set((state) => {
        const { [tapNodeId]: _, ...remaining } = state.sessions
        return { sessions: remaining }
      })
    }

    // Set connecting status
    set((state) => ({
      sessions: {
        ...state.sessions,
        [tapNodeId]: {
          sessionHandle: "",
          operationHandle: "",
          tapNodeId,
          tapName,
          status: "connecting",
          columns: [],
          currentResultToken: 0,
        },
      },
    }))

    try {
      // Open session with pipeline.name so the Flink job is identifiable
      const { sessionHandle } = await apiRequest<{ sessionHandle: string }>(
        "v1/sessions",
        "POST",
        { properties: { "pipeline.name": `flink-reactor-tap-${tapName}` } },
      )

      // Split observation SQL into individual statements (CREATE TABLE + SELECT).
      // The SQL Gateway processes one statement per POST — submitting both as a
      // single request only executes the DDL, and fetching results from a DDL
      // operation handle returns 500.
      const statements = splitStatements(observationSql)

      const terminalErrors = new Set(["ERROR", "CANCELED", "CLOSED", "TIMEOUT"])

      let operationHandle = ""

      for (const stmt of statements) {
        const result = await apiRequest<{ operationHandle: string }>(
          `v1/sessions/${sessionHandle}/statements`,
          "POST",
          { statement: stmt },
        )
        operationHandle = result.operationHandle

        // DDL statements (CREATE TABLE): poll until FINISHED before proceeding.
        // SELECT queries (streaming): poll until RUNNING, then fetch results.
        const isQuery = /^\s*SELECT\b/i.test(stmt)
        const readyStatuses = isQuery
          ? new Set(["RUNNING", "FINISHED"])
          : new Set(["FINISHED"])

        for (let attempt = 0; attempt < 60; attempt++) {
          const { status: opStatus } = await apiRequest<{ status: string }>(
            `v1/sessions/${sessionHandle}/operations/${operationHandle}/status`,
          )
          if (readyStatuses.has(opStatus)) break
          if (terminalErrors.has(opStatus)) {
            // Fetch the actual exception from the result endpoint
            const errorDetail = await fetchOperationError(
              sessionHandle,
              operationHandle,
            )
            throw new Error(
              errorDetail ?? `Operation failed with status: ${opStatus}`,
            )
          }
          await new Promise((r) => setTimeout(r, 500))
        }
      }

      // Fetch first result page for column metadata + initial rows.
      // operationHandle is now the SELECT's handle (the last statement).
      const resultData = await apiRequest<{
        results: {
          columns: Array<{
            name: string
            logicalType: { type: string; nullable: boolean }
          }>
          data: Array<{ kind: string; fields: unknown[] }>
        }
        resultType: string
      }>(`v1/sessions/${sessionHandle}/operations/${operationHandle}/result/0`)

      const columns: ColumnInfo[] = (resultData.results?.columns ?? []).map(
        (col) => ({
          columnName: col.name,
          dataType: col.logicalType.type,
          nullable: col.logicalType.nullable,
        }),
      )

      // Transition to streaming — token 0 was consumed, next poll starts at 1
      set((state) => ({
        sessions: {
          ...state.sessions,
          [tapNodeId]: {
            sessionHandle,
            operationHandle,
            tapNodeId,
            tapName,
            status: "streaming",
            columns,
            currentResultToken: 1,
          },
        },
      }))

      // Return first page data so the caller can process initial rows
      return {
        columns,
        rows: resultData.results?.data ?? [],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed"
      set((state) => ({
        sessions: {
          ...state.sessions,
          [tapNodeId]: {
            ...state.sessions[tapNodeId],
            status: "error",
            error: message,
          },
        },
      }))
      return null
    }
  },

  pauseTap: (tapNodeId) => {
    set((state) => {
      const session = state.sessions[tapNodeId]
      if (!session || session.status !== "streaming") return state
      return {
        sessions: {
          ...state.sessions,
          [tapNodeId]: { ...session, status: "paused" },
        },
      }
    })
  },

  resumeTap: (tapNodeId) => {
    set((state) => {
      const session = state.sessions[tapNodeId]
      if (!session || session.status !== "paused") return state
      return {
        sessions: {
          ...state.sessions,
          [tapNodeId]: { ...session, status: "streaming" },
        },
      }
    })
  },

  updateResultToken: (tapNodeId, token) => {
    set((state) => {
      const session = state.sessions[tapNodeId]
      if (!session) return state
      return {
        sessions: {
          ...state.sessions,
          [tapNodeId]: { ...session, currentResultToken: token },
        },
      }
    })
  },

  stopTap: async (tapNodeId) => {
    const session = get().sessions[tapNodeId]
    if (!session) return

    try {
      // Cancel operation if it's active
      if (
        session.operationHandle &&
        (session.status === "streaming" || session.status === "paused")
      ) {
        await apiRequest(
          `v1/sessions/${session.sessionHandle}/operations/${session.operationHandle}/cancel`,
          "POST",
        ).catch(() => {})
      }

      // Close session
      if (session.sessionHandle) {
        await apiRequest(
          `v1/sessions/${session.sessionHandle}`,
          "DELETE",
        ).catch(() => {})
      }
    } finally {
      // Remove from store regardless of cleanup success
      set((state) => {
        const { [tapNodeId]: _, ...remaining } = state.sessions
        return { sessions: remaining }
      })
    }
  },

  stopAll: async () => {
    const sessions = get().sessions
    const nodeIds = Object.keys(sessions)

    await Promise.allSettled(nodeIds.map((nodeId) => get().stopTap(nodeId)))
  },
}))
