import type { MaterializedTable } from "../types"

export function createMaterializedTable(overrides?: Partial<MaterializedTable>): MaterializedTable {
  return {
    name: "daily_order_summary",
    catalog: "default_catalog",
    database: "default_database",
    refreshStatus: "ACTIVATED",
    refreshMode: "CONTINUOUS",
    freshness: "PT1M",
    definingQuery: "SELECT date_format(created_at, 'yyyy-MM-dd') AS day, SUM(amount) AS total FROM orders GROUP BY date_format(created_at, 'yyyy-MM-dd')",
    ...overrides,
  }
}
