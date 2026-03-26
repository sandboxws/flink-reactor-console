"use client"

import { createCatalogSchema } from "../../fixtures"
import type { CatalogColumnInfo } from "../../components/catalogs/columns-table"
import { CatalogBrowserSection } from "./catalog-browser-section"

const schema = createCatalogSchema()
const columns: CatalogColumnInfo[] = schema.columns.map((c) => ({
  name: c.name,
  type: c.type,
}))

/** Standalone demo of the catalog browser section with fixture catalog schema data. */
export function CatalogBrowserSectionDemo() {
  return (
    <div className="max-w-2xl rounded-lg border border-dash-border bg-dash-surface">
      <CatalogBrowserSection
        tableName={`${schema.catalog}.${schema.database}.${schema.table}`}
        columns={columns}
      />
    </div>
  )
}
