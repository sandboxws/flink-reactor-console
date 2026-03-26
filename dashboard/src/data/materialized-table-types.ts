/**
 * Domain types for Flink materialized tables.
 *
 * Defines the MaterializedTable interface, refresh status enum, and
 * helper functions for mapping status to UI badge colors and labels.
 *
 * @module
 */

/** Lifecycle status of a materialized table's refresh schedule. */
export type MaterializedTableRefreshStatus =
  | "ACTIVATED"
  | "SUSPENDED"
  | "INITIALIZING"

/** A Flink materialized table with refresh scheduling metadata. */
export interface MaterializedTable {
  /** Fully-qualified table name. */
  readonly name: string
  /** Catalog containing this table. */
  readonly catalog: string
  /** Database within the catalog. */
  readonly database: string
  /** Current refresh lifecycle status. */
  readonly refreshStatus: MaterializedTableRefreshStatus
  /** Refresh mode (e.g. "FULL", "CONTINUOUS"), or null if not configured. */
  readonly refreshMode: string | null
  /** Freshness interval (e.g. "PT1H"), or null if not configured. */
  readonly freshness: string | null
  /** SQL query that defines the materialized view, or null. */
  readonly definingQuery: string | null
}

/** Badge color for a refresh status indicator. */
export type RefreshStatusColor = "green" | "amber" | "blue"

/** Map a refresh status to its corresponding badge color. */
export function getRefreshStatusColor(
  status: MaterializedTableRefreshStatus,
): RefreshStatusColor {
  switch (status) {
    case "ACTIVATED":
      return "green"
    case "SUSPENDED":
      return "amber"
    case "INITIALIZING":
      return "blue"
  }
}

/** Map a refresh status to its human-readable display label. */
export function getRefreshStatusLabel(
  status: MaterializedTableRefreshStatus,
): string {
  switch (status) {
    case "ACTIVATED":
      return "Activated"
    case "SUSPENDED":
      return "Suspended"
    case "INITIALIZING":
      return "Initializing"
  }
}
