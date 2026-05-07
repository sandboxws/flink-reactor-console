/**
 * Schema preview pane for a single catalog table.
 *
 * Renders a column list with type tints (`.tk-typ`, `.tk-key`, etc.) plus
 * the table's DDL in a `.code-viewer`. When no table is selected, shows
 * a centered hint rather than empty whitespace.
 */

import { Code2 } from "lucide-react"
import type { ColumnInfo } from "@/graphql/generated/types"

interface SchemaPreviewProps {
  selected: { catalog: string; database: string; table: string } | null
  columns: ColumnInfo[]
  ddl: string | undefined
}

function tintForType(type: string): string {
  const lower = type.toLowerCase()
  if (
    lower.includes("varchar") ||
    lower.includes("char") ||
    lower.includes("string")
  )
    return "tk-str"
  if (
    lower.includes("int") ||
    lower.includes("bigint") ||
    lower.includes("decimal")
  )
    return "tk-num"
  if (
    lower.includes("timestamp") ||
    lower.includes("date") ||
    lower.includes("time")
  )
    return "tk-attr"
  if (lower.includes("array") || lower.includes("map") || lower.includes("row"))
    return "tk-typ"
  return "tk-key"
}

export function SchemaPreview({ selected, columns, ddl }: SchemaPreviewProps) {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Code2 className="size-6 text-fg-faint" />
        <p className="text-[12px] font-mono text-fg-faint">
          Select a table to preview its schema
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="section-heading mb-3">Columns · {selected.table}</h3>
        {columns.length === 0 ? (
          <p className="text-[11px] font-mono text-fg-faint">
            No columns loaded yet — expand the table in the tree to fetch.
          </p>
        ) : (
          <div className="space-y-1 text-[12px]">
            {columns.map((col) => (
              <div
                key={col.name}
                className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-dash-elevated/40 rounded-md"
              >
                <span className="font-mono text-fg">{col.name}</span>
                <span
                  className={`font-mono text-[11px] ${tintForType(col.type)}`}
                >
                  {col.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {ddl ? (
        <div>
          <h3 className="section-heading mb-3">DDL</h3>
          <pre className="code-viewer text-[11px] font-mono whitespace-pre-wrap">
            {ddl}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
