"use client"

import { createMaterializedTable } from "../../fixtures"
import { MatTablesSection } from "./mat-tables-section"

const tables = [
  createMaterializedTable(),
  createMaterializedTable({
    name: "hourly_revenue_by_region",
    refreshStatus: "ACTIVATED",
    refreshMode: "CONTINUOUS",
    freshness: "PT5M",
  }),
  createMaterializedTable({
    name: "customer_lifetime_value",
    refreshStatus: "SUSPENDED",
    refreshMode: "FULL",
    freshness: "PT1H",
  }),
  createMaterializedTable({
    name: "product_inventory_snapshot",
    refreshStatus: "INITIALIZING",
    refreshMode: "CONTINUOUS",
    freshness: null,
  }),
]

/** Standalone demo of the materialized tables section with fixture table data. */
export function MatTablesSectionDemo() {
  return (
    <div className="max-w-4xl rounded-lg border border-dash-border bg-dash-surface">
      <MatTablesSection tables={tables} />
    </div>
  )
}
