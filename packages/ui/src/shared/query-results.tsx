"use client"

import { AlertTriangle, Clock, Loader2, Rows3 } from "lucide-react"

export interface QueryResultsProps {
  columns: { name: string; dataType: string }[]
  rows: (Record<string, unknown> | null)[][]
  rowCount: number
  executionTimeMs?: number
  truncated?: boolean
  streaming?: boolean
}

export function QueryResults({
  columns,
  rows,
  rowCount,
  executionTimeMs,
  truncated,
  streaming,
}: QueryResultsProps) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 border-b border-dash-border px-3 py-1.5 text-xs text-zinc-500">
        {streaming ? (
          <span className="flex items-center gap-1 text-fr-amber">
            <Loader2 className="size-3 animate-spin" />
            Streaming... ({rowCount.toLocaleString()} row
            {rowCount !== 1 ? "s" : ""})
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Rows3 className="size-3" />
            {rowCount.toLocaleString()} row
            {rowCount !== 1 ? "s" : ""}
          </span>
        )}
        {executionTimeMs !== undefined && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {executionTimeMs}ms
          </span>
        )}
        {truncated && (
          <span className="flex items-center gap-1 text-fr-amber">
            <AlertTriangle className="size-3" />
            Results truncated
          </span>
        )}
      </div>

      {/* Data grid */}
      {rowCount === 0 && !streaming ? (
        <div className="p-4 text-center text-xs text-zinc-500">
          Query returned no rows
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border text-left text-zinc-500">
                {columns.map((col) => (
                  <th key={col.name} className="px-3 py-2 font-medium">
                    <div>{col.name}</div>
                    <div className="font-mono text-[10px] text-zinc-600">
                      {col.dataType}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-white/[0.02]">
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className="max-w-[300px] truncate px-3 py-1.5 font-mono text-zinc-300"
                    >
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatCell(cell: Record<string, unknown> | null): string {
  if (cell === null || cell === undefined) return "NULL"
  // The GraphQL response wraps each cell in {v: value}
  const value = cell.v
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
