"use client"

import { Database, Table2 } from "lucide-react"
import { ColumnsTable, type CatalogColumnInfo } from "../../components/catalogs/columns-table"
import { EmptyState } from "../../shared/empty-state"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CatalogBrowserSectionProps {
  columns: CatalogColumnInfo[]
  tableName: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CatalogBrowserSection({
  columns,
  tableName,
}: CatalogBrowserSectionProps) {
  if (columns.length === 0) {
    return (
      <EmptyState
        icon={Table2}
        message="No columns available for this table."
      />
    )
  }

  return (
    <section className="p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Database className="size-4 text-fr-purple" />
        <h2 className="text-sm font-semibold text-zinc-100">{tableName}</h2>
        <span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-zinc-500">
          {columns.length} column{columns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Description */}
      <p className="mb-4 text-xs text-zinc-500">
        Schema columns for <span className="font-mono text-zinc-400">{tableName}</span>.
        Use the search to filter by column name or type.
      </p>

      {/* Columns table */}
      <ColumnsTable columns={columns} />
    </section>
  )
}
