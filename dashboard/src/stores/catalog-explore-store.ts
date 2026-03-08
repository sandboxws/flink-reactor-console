import { create } from "zustand"
import {
  createSQLSession,
  fetchSQLResults,
  submitSQLStatement,
} from "@/lib/graphql-api-client"

const MAX_ROWS = 10_000

type ExploreStatus =
  | "idle"
  | "submitting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

interface ExploreState {
  sessionHandle: string | null
  sql: string
  status: ExploreStatus
  columns: Array<{ name: string; dataType: string }>
  rows: Array<Array<string | null>>
  streaming: boolean
  error: string | null
  cancelled: boolean
}

interface ExploreActions {
  setSql: (sql: string) => void
  executeQuery: () => Promise<void>
  cancelQuery: () => void
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

        // Tag the job with the explore prefix
        const truncatedSql = sql.length > 80 ? `${sql.slice(0, 80)}...` : sql
        const pipelineName = `explore: ${truncatedSql}`
        try {
          await submitSQLStatement(
            session,
            `SET 'pipeline.name' = '${pipelineName.replaceAll("'", "''")}'`,
          )
        } catch {
          // SET may fail on some SQL Gateway versions; continue anyway
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

            // Re-tag with pipeline name
            try {
              await submitSQLStatement(
                session,
                `SET 'pipeline.name' = '${pipelineName.replaceAll("'", "''")}'`,
              )
            } catch {
              // Ignore SET failures
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
