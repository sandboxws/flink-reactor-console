import { Spinner } from "@flink-reactor/ui"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ArrowUp } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import type { ColumnInfo } from "@/stores/sql-gateway-store"

interface TapDataTableProps {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  isStreaming: boolean
  autoScroll?: boolean
}

type SortDirection = "asc" | "desc" | null
interface SortState {
  column: string | null
  direction: SortDirection
}

const ROW_HEIGHT = 28

/**
 * Virtualized streaming data table for tap observation.
 *
 * Uses @tanstack/react-virtual to efficiently render 10k+ rows.
 * Only DOM nodes in the viewport (+ overscan buffer) are rendered.
 *
 * Features: fixed header, auto-scroll, column sort, cell formatting,
 * row highlight on append, empty/waiting states.
 */
export function TapDataTable({
  columns,
  rows,
  isStreaming,
  autoScroll: autoScrollProp = true,
}: TapDataTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoScrollProp)
  const [sort, setSort] = useState<SortState>({ column: null, direction: null })
  const prevRowCount = useRef(rows.length)

  // Sort rows if sort is active
  const sortedRows = useMemo(() => {
    if (!sort.column) return rows
    const col = sort.column
    return [...rows].sort((a, b) => {
      const aVal = a[col]
      const bVal = b[col]
      const cmp = compareValues(aVal, bVal)
      return sort.direction === "desc" ? -cmp : cmp
    })
  }, [rows, sort.column, sort.direction])

  // Virtual row renderer
  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  // Auto-scroll to bottom when new rows arrive
  useEffect(() => {
    if (autoScrollEnabled && sortedRows.length > 0) {
      virtualizer.scrollToIndex(sortedRows.length - 1, { align: "end" })
    }
    prevRowCount.current = rows.length
  }, [rows.length, autoScrollEnabled, sortedRows.length, virtualizer])

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScrollEnabled(atBottom)
  }, [])

  // Toggle sort on column header click
  const handleSort = (colName: string) => {
    setSort((prev) => {
      if (prev.column === colName) {
        if (prev.direction === "asc")
          return { column: colName, direction: "desc" }
        if (prev.direction === "desc") return { column: null, direction: null }
      }
      return { column: colName, direction: "asc" }
    })
    setAutoScrollEnabled(false)
  }

  // Empty state
  if (columns.length === 0 && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
        {isStreaming ? (
          <>
            <Spinner size="lg" className="opacity-40" />
            <p className="text-xs">Waiting for data...</p>
          </>
        ) : (
          <p className="text-xs">No data yet. Click Play to start observing.</p>
        )}
      </div>
    )
  }

  // Column names for grid
  const colNames = columns.map((c) => c.columnName)

  // Dynamic grid template
  const gridTemplate = columns
    .map((c) => {
      const headerWidth = Math.max(c.columnName.length * 7 + 32, 80)
      return `minmax(${headerWidth}px, 1fr)`
    })
    .join(" ")

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-dash-border">
      {/* Fixed header */}
      <div
        className="grid border-b border-dash-border bg-dash-elevated/50"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <button
            key={col.columnName}
            type="button"
            onClick={() => handleSort(col.columnName)}
            className="flex items-center gap-1 px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition-colors hover:text-zinc-200"
            title={`${col.columnName} (${col.dataType}${col.nullable ? ", nullable" : ""})`}
          >
            <span className="truncate">{col.columnName}</span>
            {sort.column === col.columnName &&
              (sort.direction === "asc" ? (
                <ArrowUp className="size-2.5 shrink-0 text-fr-purple" />
              ) : (
                <ArrowDown className="size-2.5 shrink-0 text-fr-purple" />
              ))}
          </button>
        ))}
      </div>

      {/* Virtualized rows */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 380px)" }}
      >
        {sortedRows.length === 0 && isStreaming ? (
          <div className="flex items-center justify-center py-8 text-xs text-zinc-500">
            <Spinner size="sm" className="mr-2" />
            Waiting for data...
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = sortedRows[virtualRow.index]
              const isNew =
                !sort.column && virtualRow.index >= prevRowCount.current

              return (
                <div
                  key={virtualRow.index}
                  className={cn(
                    "absolute left-0 grid w-full border-b border-dash-border/30 text-xs transition-colors hover:bg-dash-hover/50",
                    isNew && "animate-tap-row-flash",
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  {colNames.map((col) => (
                    <div
                      key={col}
                      className="flex items-center truncate px-2 font-mono"
                      title={String(row[col] ?? "")}
                    >
                      <CellValue value={row[col]} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom indicator */}
      {!autoScrollEnabled && isStreaming && (
        <button
          type="button"
          onClick={() => {
            setAutoScrollEnabled(true)
            virtualizer.scrollToIndex(sortedRows.length - 1, {
              align: "end",
            })
          }}
          className="flex items-center justify-center gap-1.5 border-t border-dash-border bg-dash-surface/80 py-1 text-[10px] font-medium text-fr-purple transition-colors hover:bg-dash-hover"
        >
          <ArrowDown className="size-3" />
          Scroll to latest
        </button>
      )}
    </div>
  )
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-600 italic">null</span>
  }

  if (typeof value === "number") {
    return (
      <span className="tabular-nums text-zinc-200">
        {value.toLocaleString()}
      </span>
    )
  }

  if (typeof value === "boolean") {
    return (
      <span className={value ? "text-job-running" : "text-zinc-500"}>
        {String(value)}
      </span>
    )
  }

  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return <span className="tabular-nums text-zinc-300">{str}</span>
  }

  return <span className="text-zinc-300">{str}</span>
}

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}
