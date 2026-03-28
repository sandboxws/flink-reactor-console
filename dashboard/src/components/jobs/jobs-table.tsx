/**
 * @module jobs-table
 *
 * Sortable table for displaying Flink jobs in either "running" or "completed" mode.
 * Detects special job types (tap observations, explore queries) and renders
 * distinguishing badges. Rows navigate to the job detail page on click.
 *
 * Subscribes to {@link useClusterStore} for tappable pipeline detection.
 */
import {
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@flink-reactor/ui"
import { useNavigate } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  Check,
  Copy,
  Radio,
  Zap,
  XCircle,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { SortIcon } from "@/components/shared/sort-icon"
import type { FlinkJob } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useClusterStore } from "@/stores/cluster-store"
import { DurationCell } from "./duration-cell"
import { JobStatusBadge } from "./job-status-badge"
import { TaskCountsBar } from "./task-counts-bar"

// ---------------------------------------------------------------------------
// Tap job detection
// ---------------------------------------------------------------------------

/** Prefix used by tap observation jobs submitted via the Tap subsystem. */
const TAP_JOB_PREFIX = "fr-tap-"

/** Check whether a job name belongs to a tap observation session. */
function isTapJob(name: string): boolean {
  return name.startsWith(TAP_JOB_PREFIX)
}

/** Strip the tap prefix to produce a human-readable name. */
function tapDisplayName(name: string): string {
  return name.slice(TAP_JOB_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Explore job detection
// ---------------------------------------------------------------------------

/** Prefix used by ad-hoc explore query jobs. */
const EXPLORE_JOB_PREFIX = "explore: "

/** Check whether a job name belongs to an explore query session. */
function isExploreJob(name: string): boolean {
  return name.startsWith(EXPLORE_JOB_PREFIX)
}

/** Strip the explore prefix to produce a human-readable name. */
function exploreDisplayName(name: string): string {
  return name.slice(EXPLORE_JOB_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

/** Sortable column identifiers for the jobs table. */
type SortKey =
  | "name"
  | "id"
  | "status"
  | "startTime"
  | "endTime"
  | "duration"
  | "tasks"

/** Sort direction for column headers. */
type SortDir = "asc" | "desc"

/** Compute effective duration, using wall-clock time for running jobs. */
function getDuration(job: FlinkJob): number {
  return job.status === "RUNNING"
    ? Date.now() - job.startTime.getTime()
    : job.duration
}

/** Sum all task status counts for a job (total parallelism). */
function getTaskTotal(job: FlinkJob): number {
  return Object.values(job.tasks).reduce((a, b) => a + b, 0)
}

/** Sort a job array by the given column and direction. Returns a new array. */
function sortJobs(jobs: FlinkJob[], key: SortKey, dir: SortDir): FlinkJob[] {
  const sorted = [...jobs].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name)
      case "id":
        return a.id.localeCompare(b.id)
      case "status":
        return a.status.localeCompare(b.status)
      case "startTime":
        return a.startTime.getTime() - b.startTime.getTime()
      case "endTime":
        return (a.endTime?.getTime() ?? 0) - (b.endTime?.getTime() ?? 0)
      case "duration":
        return getDuration(a) - getDuration(b)
      case "tasks":
        return getTaskTotal(a) - getTaskTotal(b)
      default:
        return 0
    }
  })
  return dir === "desc" ? sorted.reverse() : sorted
}


// ---------------------------------------------------------------------------
// Copy-on-click Job ID cell
// ---------------------------------------------------------------------------

/** Truncated job ID with click-to-copy behavior and tooltip showing full ID. */
function JobIdCell({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [id],
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="group/id inline-flex max-w-28 items-center gap-1 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <span className="truncate">{id}</span>
            {copied ? (
              <Check className="size-3 shrink-0 text-job-running" />
            ) : (
              <Copy className="size-3 shrink-0 opacity-0 group-hover/id:opacity-100" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : id}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Cancel button
// ---------------------------------------------------------------------------

/** Inline cancel button that stops event propagation to avoid triggering row navigation. */
function CancelButton({
  jobId,
  onCancel,
}: {
  jobId: string
  onCancel: (id: string) => void
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCancel(jobId)
    },
    [jobId, onCancel],
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="rounded p-1 text-zinc-600 transition-colors hover:bg-job-failed/10 hover:text-job-failed"
          >
            <XCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Cancel job</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** Table column definition binding a {@link SortKey} to its display label. */
type ColumnDef = {
  /** Sort field this column maps to. */
  key: SortKey
  /** Human-readable column header text. */
  label: string
  /** Optional Tailwind text alignment class (e.g. "text-right"). */
  align?: string
}

/** Columns shown for running jobs (no end-time column). */
const runningColumns: ColumnDef[] = [
  { key: "name", label: "Job Name" },
  { key: "id", label: "Job ID" },
  { key: "status", label: "Status" },
  { key: "startTime", label: "Start Time" },
  { key: "duration", label: "Duration", align: "text-right" },
  { key: "tasks", label: "Tasks", align: "text-right" },
]

/** Columns shown for completed jobs (includes end-time column). */
const completedColumns: ColumnDef[] = [
  { key: "name", label: "Job Name" },
  { key: "id", label: "Job ID" },
  { key: "status", label: "Status" },
  { key: "startTime", label: "Start Time" },
  { key: "endTime", label: "End Time" },
  { key: "duration", label: "Duration", align: "text-right" },
  { key: "tasks", label: "Tasks", align: "text-right" },
]

// ---------------------------------------------------------------------------
// JobsTable
// ---------------------------------------------------------------------------

/**
 * Sortable table of {@link FlinkJob} entries with client-side sorting.
 *
 * In "running" mode, an extra cancel-action column is rendered and the default
 * sort is by start time. In "completed" mode, an end-time column is added and
 * the default sort is by end time. Tap and explore jobs are visually tagged
 * with colored badges; tappable pipelines show a radio icon.
 */
export function JobsTable({
  mode,
  jobs,
  onCancelJob,
}: {
  /** Whether to show running or completed column layout. */
  mode: "running" | "completed"
  /** Job list to display. */
  jobs: FlinkJob[]
  /** Cancel callback; when provided, running rows get a cancel button. */
  onCancelJob?: (jobId: string) => void
}) {
  const navigate = useNavigate()
  const tappablePipelines = useClusterStore((s) => s.tappablePipelines)
  const isRunning = mode === "running"
  const columns = isRunning ? runningColumns : completedColumns

  const defaultSortKey: SortKey = isRunning ? "startTime" : "endTime"
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(
    () => sortJobs(jobs, sortKey, sortDir),
    [jobs, sortKey, sortDir],
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        message={isRunning ? "No running jobs" : "No matching jobs"}
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn("group cursor-pointer select-none", col.align)}
              onClick={() => toggleSort(col.key)}
              aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                <SortIcon column={col.key} active={sortKey} direction={sortDir} />
              </span>
            </TableHead>
          ))}
          {isRunning && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((job) => (
          <TableRow
            key={job.id}
            className="cursor-pointer"
            onClick={() => navigate({ to: `/jobs/${job.id}` })}
          >
            <TableCell className="max-w-48">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {isTapJob(job.name) ? (
                        <span className="shrink-0 rounded-full bg-fr-purple/20 px-1.5 py-0.5 text-[10px] font-medium text-fr-purple">
                          TAP
                        </span>
                      ) : isExploreJob(job.name) ? (
                        <span className="shrink-0 rounded-full bg-fr-coral/20 px-1.5 py-0.5 text-[10px] font-medium text-fr-coral">
                          EXPLORE
                        </span>
                      ) : tappablePipelines.has(job.name) ? (
                        <Radio className="size-3.5 shrink-0 text-fr-purple/60" />
                      ) : null}
                      <span className="truncate">
                        {isTapJob(job.name)
                          ? tapDisplayName(job.name)
                          : isExploreJob(job.name)
                            ? exploreDisplayName(job.name)
                            : job.name}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isTapJob(job.name)
                      ? "Tap observation job"
                      : isExploreJob(job.name)
                        ? "Explore query job"
                        : tappablePipelines.has(job.name)
                          ? "Tappable pipeline"
                          : job.name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell>
              <JobIdCell id={job.id} />
            </TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell className="text-xs text-zinc-400">
              {format(job.startTime, "yyyy-MM-dd HH:mm:ss")}
            </TableCell>
            {!isRunning && (
              <TableCell className="text-xs text-zinc-400">
                {job.endTime ? format(job.endTime, "yyyy-MM-dd HH:mm:ss") : "—"}
              </TableCell>
            )}
            <TableCell className="text-right">
              <DurationCell
                startTime={job.startTime}
                endTime={job.endTime}
                isRunning={job.status === "RUNNING"}
              />
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <TaskCountsBar tasks={job.tasks} />
              </div>
            </TableCell>
            {isRunning && onCancelJob && (
              <TableCell>
                <CancelButton jobId={job.id} onCancel={onCancelJob} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
