/**
 * Domain types for Flink materialized tables.
 */

export type MaterializedTableRefreshStatus =
  | "ACTIVATED"
  | "SUSPENDED"
  | "INITIALIZING"

/** A column in a materialized table's schema (Flink 2.3+, from DESCRIBE). */
export interface MaterializedColumn {
  readonly name: string
  readonly type: string
  readonly nullable: boolean
  readonly primaryKey: boolean
  /** Watermark expression when the column is a rowtime attribute, else null. */
  readonly watermark: string | null
}

export interface MaterializedTable {
  readonly name: string
  readonly catalog: string
  readonly database: string
  readonly refreshStatus: MaterializedTableRefreshStatus
  readonly refreshMode: string | null
  readonly freshness: string | null
  readonly definingQuery: string | null
  /** Schema columns (Flink 2.3+); empty on older clusters. */
  readonly columns: readonly MaterializedColumn[]
}

/** Refresh status badge color mapping */
export type RefreshStatusColor = "green" | "amber" | "blue"
