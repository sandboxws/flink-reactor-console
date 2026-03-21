/**
 * Domain types for Flink materialized tables.
 */

export type MaterializedTableRefreshStatus =
  | "ACTIVATED"
  | "SUSPENDED"
  | "INITIALIZING"

export interface MaterializedTable {
  readonly name: string
  readonly catalog: string
  readonly database: string
  readonly refreshStatus: MaterializedTableRefreshStatus
  readonly refreshMode: string | null
  readonly freshness: string | null
  readonly definingQuery: string | null
}

/** Refresh status badge color mapping */
export type RefreshStatusColor = "green" | "amber" | "blue"
