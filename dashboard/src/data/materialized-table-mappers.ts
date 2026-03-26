/**
 * Pure mapper functions: GraphQL response → MaterializedTable domain types.
 *
 * Maps raw GraphQL materialized table responses to typed domain objects,
 * normalizing refresh status to a known enum with a safe default.
 *
 * @module
 */
import type {
  MaterializedTable,
  MaterializedTableRefreshStatus,
} from "./materialized-table-types"

/** Raw GraphQL response shape for a materialized table. */
interface GqlMaterializedTable {
  name: string
  catalog: string
  database: string
  refreshStatus: string
  refreshMode: string | null
  freshness: string | null
  definingQuery: string | null
}

const VALID_STATUSES = new Set<string>([
  "ACTIVATED",
  "SUSPENDED",
  "INITIALIZING",
])

/** Normalize a raw refresh status string to a known enum value (defaults to INITIALIZING). */
function mapRefreshStatus(raw: string): MaterializedTableRefreshStatus {
  if (VALID_STATUSES.has(raw)) return raw as MaterializedTableRefreshStatus
  return "INITIALIZING"
}

/** Map a single GraphQL materialized table response to a domain object. */
export function mapMaterializedTable(
  raw: GqlMaterializedTable,
): MaterializedTable {
  return {
    name: raw.name,
    catalog: raw.catalog,
    database: raw.database,
    refreshStatus: mapRefreshStatus(raw.refreshStatus),
    refreshMode: raw.refreshMode,
    freshness: raw.freshness,
    definingQuery: raw.definingQuery,
  }
}

/** Map an array of GraphQL materialized table responses to domain objects. */
export function mapMaterializedTables(
  raw: GqlMaterializedTable[],
): MaterializedTable[] {
  return raw.map(mapMaterializedTable)
}
