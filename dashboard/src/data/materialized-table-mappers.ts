/**
 * Pure mapper functions: GraphQL response → MaterializedTable domain types.
 */
import type {
  MaterializedTable,
  MaterializedTableRefreshStatus,
} from "./materialized-table-types"

// GraphQL response shape
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

function mapRefreshStatus(raw: string): MaterializedTableRefreshStatus {
  if (VALID_STATUSES.has(raw)) return raw as MaterializedTableRefreshStatus
  return "INITIALIZING"
}

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

export function mapMaterializedTables(
  raw: GqlMaterializedTable[],
): MaterializedTable[] {
  return raw.map(mapMaterializedTable)
}
