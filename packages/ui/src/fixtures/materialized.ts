/** Fixture data for Flink SQL materialized tables with refresh configuration. */

import type { MaterializedTable } from "../types"

/** Create a continuously-refreshed materialized table for daily order summaries. */
export function createMaterializedTable(
  overrides?: Partial<MaterializedTable>,
): MaterializedTable {
  return {
    name: "daily_order_summary",
    catalog: "default_catalog",
    database: "default_database",
    refreshStatus: "ACTIVATED",
    refreshMode: "CONTINUOUS",
    freshness: "PT1M",
    definingQuery:
      "SELECT date_format(created_at, 'yyyy-MM-dd') AS day, SUM(amount) AS total FROM orders GROUP BY date_format(created_at, 'yyyy-MM-dd')",
    columns: [
      {
        name: "day",
        type: "STRING",
        nullable: false,
        primaryKey: true,
        watermark: null,
      },
      {
        name: "total",
        type: "DECIMAL(10, 2)",
        nullable: true,
        primaryKey: false,
        watermark: null,
      },
    ],
    ...overrides,
  }
}
