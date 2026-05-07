/**
 * Linear-style row for a materialized table in the list view.
 *
 * Renders name + refresh status badge + refresh mode + freshness + chevron
 * into the detail. Uses status pill colors per badge color.
 */

import { Link } from "@tanstack/react-router"
import { ChevronRight, Database } from "lucide-react"
import {
  getRefreshStatusColor,
  getRefreshStatusLabel,
  type MaterializedTable,
} from "@/data/materialized-table-types"

interface MaterializedTableRowProps {
  table: MaterializedTable
}

const COLOR_CLASSES = {
  green: "text-fr-sage bg-fr-sage/10 border-fr-sage/25",
  amber: "text-fr-amber bg-fr-amber/10 border-fr-amber/25",
  blue: "text-fr-teal bg-fr-teal/10 border-fr-teal/25",
} as const

export function MaterializedTableRow({ table }: MaterializedTableRowProps) {
  const color = getRefreshStatusColor(table.refreshStatus)
  return (
    <Link
      to="/hub/materialized-tables/$name"
      params={{ name: table.name }}
      search={{ catalog: table.catalog }}
      className="grid grid-cols-[24px_1fr_120px_140px_120px_16px] items-center gap-3 px-3 py-2.5 hover:bg-dash-elevated/40 border-b border-dash-border/40"
    >
      <Database className="size-4 text-fr-amber" />
      <div className="min-w-0">
        <div className="font-mono text-[13px] text-fg truncate">
          {table.name}
        </div>
        <div className="font-mono text-[10px] text-fg-faint truncate">
          {table.catalog}.{table.database}
        </div>
      </div>
      <span
        className={`label-chip border text-[10px] inline-block w-fit ${COLOR_CLASSES[color]}`}
      >
        {getRefreshStatusLabel(table.refreshStatus)}
      </span>
      <span className="font-mono text-[11px] text-fg-muted truncate">
        {table.refreshMode ?? "—"}
      </span>
      <span className="font-mono text-[11px] text-fg-muted">
        {table.freshness ?? "—"}
      </span>
      <ChevronRight className="size-3.5 text-fg-faint" />
    </Link>
  )
}
