/**
 * @module job-history-table
 *
 * Server-paginated, sortable table of historical {@link JobHistoryEntry} records
 * fetched via GraphQL. Sorting and pagination are controlled by the parent
 * (typically the completed-jobs route) through callback props, keeping this
 * component stateless with respect to data fetching.
 *
 * Rows navigate to the job detail page on click.
 */
import {
  formatDuration,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flink-reactor/ui"
import { useNavigate } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import type { JobStatus } from "@flink-reactor/ui"
import { SortIcon } from "@/components/shared/sort-icon"
import { cn } from "@/lib/cn"
import type { JobHistoryEntry } from "@/lib/graphql-api-client"
import { JobStatusBadge } from "./job-status-badge"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Server-side sort field matching the GraphQL `JobHistoryOrderField` enum. */
type OrderField = "START_TIME" | "END_TIME" | "DURATION" | "NAME" | "STATE"

/** Server-side sort direction matching the GraphQL ordering convention. */
type OrderDirection = "ASC" | "DESC"

/** Column definition for the history table, including optional fixed width. */
type ColumnDef = {
  /** GraphQL order field this column maps to. */
  key: OrderField
  /** Human-readable column header. */
  label: string
  /** Optional Tailwind text alignment class. */
  align?: string
  /** Optional Tailwind width class for fixed-layout columns. */
  width?: string
}

/** Fixed column layout for the job history table. */
const columns: ColumnDef[] = [
  { key: "NAME", label: "Name", width: "w-[44%]" },
  { key: "STATE", label: "Status", width: "w-[10%]" },
  { key: "START_TIME", label: "Start Time", width: "w-[18%]" },
  { key: "END_TIME", label: "End Time", width: "w-[18%]" },
  { key: "DURATION", label: "Duration", width: "w-[10%]" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp string for display, returning a dash for null/invalid values. */
function formatTimestamp(ts: string | null): string {
  if (!ts) return "—"
  try {
    return format(new Date(ts), "yyyy-MM-dd HH:mm:ss")
  } catch {
    return "—"
  }
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

/** Previous/Next pagination footer with "Showing X-Y of Z" label. */
function PaginationControls({
  currentPage,
  pageSize,
  totalCount,
  hasNextPage,
  onNext,
  onPrev,
}: {
  currentPage: number
  pageSize: number
  totalCount: number
  hasNextPage: boolean
  onNext: () => void
  onPrev: () => void
}) {
  const start = currentPage * pageSize + 1
  const end = Math.min(start + pageSize - 1, totalCount)

  return (
    <div className="flex items-center justify-between border-t border-dash-border px-4 py-3">
      <span className="text-xs text-zinc-500">
        Showing {start}-{end} of {totalCount} jobs
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 0}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-dash-panel hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNextPage}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-dash-panel hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JobHistoryTable
// ---------------------------------------------------------------------------

/**
 * Paginated table of historical job runs with server-side sorting.
 *
 * All data fetching, sorting, and pagination state is owned by the parent;
 * this component is a controlled presentation layer that fires callbacks
 * for sort toggling and page navigation.
 */
export function JobHistoryTable({
  entries,
  totalCount,
  hasNextPage,
  currentPage,
  pageSize,
  orderField,
  orderDirection,
  onSort,
  onNextPage,
  onPrevPage,
}: {
  /** Current page of {@link JobHistoryEntry} records from the server. */
  entries: JobHistoryEntry[]
  /** Total matching records across all pages. */
  totalCount: number
  /** Whether the server has more records after the current page. */
  hasNextPage: boolean
  /** Zero-based current page index. */
  currentPage: number
  /** Number of records per page. */
  pageSize: number
  /** Currently active sort field. */
  orderField: OrderField
  /** Current sort direction. */
  orderDirection: OrderDirection
  /** Called when a column header is clicked to toggle sort. */
  onSort: (field: OrderField) => void
  /** Navigate to the next page. */
  onNextPage: () => void
  /** Navigate to the previous page. */
  onPrevPage: () => void
}) {
  const navigate = useNavigate()

  if (entries.length === 0 && currentPage === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-600">
        No jobs found for the selected time range
      </p>
    )
  }

  return (
    <div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "group cursor-pointer select-none",
                  col.align,
                  col.width,
                )}
                onClick={() => onSort(col.key)}
                aria-sort={orderField === col.key ? (orderDirection === "ASC" ? "ascending" : "descending") : "none"}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  <SortIcon
                    column={col.key}
                    active={orderField}
                    direction={orderDirection}
                  />
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={`${entry.cluster}-${entry.jid}`}
              className="cursor-pointer"
              onClick={() => navigate({ to: `/jobs/${entry.jid}` })}
            >
              <TableCell>
                <span className="block truncate font-medium">{entry.name}</span>
              </TableCell>
              <TableCell>
                <JobStatusBadge status={entry.state as JobStatus} />
              </TableCell>
              <TableCell className="text-xs text-zinc-400">
                {formatTimestamp(entry.startTime)}
              </TableCell>
              <TableCell className="text-xs text-zinc-400">
                {formatTimestamp(entry.endTime)}
              </TableCell>
              <TableCell className="font-mono text-xs text-zinc-400">
                {formatDuration(entry.durationMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalCount > pageSize && (
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          hasNextPage={hasNextPage}
          onNext={onNextPage}
          onPrev={onPrevPage}
        />
      )}
    </div>
  )
}
