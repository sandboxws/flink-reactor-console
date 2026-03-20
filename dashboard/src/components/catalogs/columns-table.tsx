import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flink-reactor/ui"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import type { ColumnInfo } from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "name" | "type"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// ColumnsTable
// ---------------------------------------------------------------------------

export function ColumnsTable({ columns }: { columns: ColumnInfo[] }) {
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [page, setPage] = useState(0)

  // Reset page when search changes
  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(0)
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
    setPage(0)
  }

  // Filter → sort → paginate
  const filtered = useMemo(() => {
    if (!search) return columns
    const q = search.toLowerCase()
    return columns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q),
    )
  }, [columns, search])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    copy.sort((a, b) => {
      const av = a[sortField].toLowerCase()
      const bv = b[sortField].toLowerCase()
      return av < bv ? -dir : av > bv ? dir : 0
    })
    return copy
  }, [filtered, sortField, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="ml-[5.5rem] mr-2 mb-1 mt-0.5 rounded-md border border-dash-border bg-dash-surface/50">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 border-b border-dash-border px-2.5 py-1.5">
        <Search className="size-3 shrink-0 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Filter columns…"
          className="flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        {search && (
          <button
            type="button"
            onClick={() => handleSearch("")}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="size-3" />
          </button>
        )}
        <span className="text-[10px] text-zinc-600">
          {filtered.length}
          {filtered.length !== columns.length && ` / ${columns.length}`}
        </span>
      </div>

      {/* Table */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-dash-border">
            <TableHead
              className="group w-[55%] cursor-pointer select-none py-1 text-[10px]"
              onClick={() => handleSort("name")}
            >
              <span className="inline-flex items-center gap-1">
                Column
                <SortIcon field="name" active={sortField} dir={sortDir} />
              </span>
            </TableHead>
            <TableHead
              className="group w-[45%] cursor-pointer select-none py-1 text-[10px]"
              onClick={() => handleSort("type")}
            >
              <span className="inline-flex items-center gap-1">
                Type
                <SortIcon field="type" active={sortField} dir={sortDir} />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="py-3 text-center text-[10px] text-zinc-600"
              >
                No columns match
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((col) => (
              <TableRow key={col.name} className="border-dash-border/50">
                <TableCell className="py-1 font-mono text-[11px] text-zinc-300">
                  <span className="block truncate">{col.name}</span>
                </TableCell>
                <TableCell className="py-1 font-mono text-[10px] text-zinc-500">
                  {col.type}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-dash-border px-2.5 py-1.5">
          <span className="text-[10px] text-zinc-600">
            {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 0}
              className={cn(
                "rounded p-0.5 text-zinc-400 transition-colors hover:bg-dash-panel hover:text-zinc-200",
                "disabled:cursor-not-allowed disabled:opacity-30",
              )}
            >
              <ChevronLeft className="size-3" />
            </button>
            <span className="text-[10px] text-zinc-500">
              {page + 1}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className={cn(
                "rounded p-0.5 text-zinc-400 transition-colors hover:bg-dash-panel hover:text-zinc-200",
                "disabled:cursor-not-allowed disabled:opacity-30",
              )}
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  active,
  dir,
}: {
  field: SortField
  active: SortField
  dir: SortDir
}) {
  if (field !== active)
    return <ArrowUpDown className="size-2.5 opacity-0 group-hover:opacity-50" />
  return dir === "asc" ? (
    <ArrowUp className="size-2.5" />
  ) : (
    <ArrowDown className="size-2.5" />
  )
}
