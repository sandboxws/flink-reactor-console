"use client"

import { Layers } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { RefreshStatusBadge } from "../../components/materialized-tables/refresh-status-badge"
import { EmptyState } from "../../shared/empty-state"
import type { MaterializedTable } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatTablesSectionProps {
  tables: MaterializedTable[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Renders the materialized tables section with table list, refresh status, and freshness. */
export function MatTablesSection({ tables }: MatTablesSectionProps) {
  if (tables.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        message="No materialized tables found."
      />
    )
  }

  return (
    <section className="p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-semibold text-zinc-100">
          Materialized Tables
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {tables.length} table{tables.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-dash-border hover:bg-transparent">
              <TableHead className="text-[10px]">Name</TableHead>
              <TableHead className="text-[10px]">Status</TableHead>
              <TableHead className="text-[10px]">Refresh Mode</TableHead>
              <TableHead className="text-[10px]">Freshness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((t) => (
              <TableRow
                key={`${t.catalog}.${t.database}.${t.name}`}
                className="border-dash-border"
              >
                <TableCell className="text-xs font-medium text-zinc-200">
                  <div className="flex flex-col">
                    <span>{t.name}</span>
                    <span className="text-[10px] text-zinc-600">
                      {t.catalog}.{t.database}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <RefreshStatusBadge status={t.refreshStatus} />
                </TableCell>
                <TableCell className="text-xs text-zinc-400">
                  {t.refreshMode ?? "\u2014"}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-400">
                  {t.freshness ?? "\u2014"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
