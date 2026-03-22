import {
  Badge,
  EmptyState,
  formatDuration,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flink-reactor/ui"
import { Link, useNavigate } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowRight,
  Briefcase,
  Radio,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { FlinkJob, JobStatus } from "@flink-reactor/ui"
import { SortIcon } from "@/components/shared/sort-icon"
import { cn } from "@/lib/cn"
import { useClusterStore } from "@/stores/cluster-store"

// ---------------------------------------------------------------------------
// Tap job detection (shared with jobs-table.tsx)
// ---------------------------------------------------------------------------

const TAP_JOB_PREFIX = "fr-tap-"

function isTapJob(name: string): boolean {
  return name.startsWith(TAP_JOB_PREFIX)
}

function tapDisplayName(name: string): string {
  return name.slice(TAP_JOB_PREFIX.length)
}

const statusColor: Record<string, string> = {
  RUNNING: "bg-job-running/15 text-job-running",
  FINISHED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELED: "bg-job-cancelled/15 text-job-cancelled",
  CANCELLING: "bg-job-cancelled/15 text-job-cancelled",
  CREATED: "bg-job-created/15 text-job-created",
  FAILING: "bg-job-failed/15 text-job-failed",
  RESTARTING: "bg-job-running/15 text-job-running",
  SUSPENDED: "bg-job-created/15 text-job-created",
  RECONCILING: "bg-job-created/15 text-job-created",
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-[0.625rem]", statusColor[status])}
    >
      {status}
    </Badge>
  )
}

type SortKey = "name" | "status" | "started" | "duration"
type SortDir = "asc" | "desc"

function getDuration(job: FlinkJob): number {
  return job.status === "RUNNING"
    ? Date.now() - job.startTime.getTime()
    : job.duration
}

function sortJobs(jobs: FlinkJob[], key: SortKey, dir: SortDir): FlinkJob[] {
  const sorted = [...jobs].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name)
      case "status":
        return a.status.localeCompare(b.status)
      case "started":
        return a.startTime.getTime() - b.startTime.getTime()
      case "duration":
        return getDuration(a) - getDuration(b)
      default:
        return 0
    }
  })
  return dir === "desc" ? sorted.reverse() : sorted
}


export function JobList({
  title,
  href,
  icon: Icon,
  jobs,
  accent,
  limit = 5,
}: {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  jobs: FlinkJob[]
  accent?: string
  limit?: number
}) {
  const navigate = useNavigate()
  const tappablePipelines = useClusterStore((s) => s.tappablePipelines)
  const [sortKey, setSortKey] = useState<SortKey>("started")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(
    () => sortJobs(jobs, sortKey, sortDir),
    [jobs, sortKey, sortDir],
  )
  const visible = sorted.slice(0, limit)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "started", label: "Started", align: "text-right" },
    { key: "duration", label: "Duration", align: "text-right" },
  ]

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-zinc-500">
        <Icon className={cn("size-4", accent)} />
        <span className="text-xs font-medium uppercase tracking-wide">
          {title}
        </span>
        <span className="text-xs tabular-nums">{jobs.length}</span>
        <Link
          to={href}
          className="ml-auto flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Briefcase} message="No jobs found" />
      ) : (
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((job) => (
              <TableRow
                key={job.id}
                className="cursor-pointer"
                onClick={() => navigate({ to: `/jobs/${job.id}` })}
              >
                <TableCell className="max-w-48">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {isTapJob(job.name) ? (
                      <span className="shrink-0 rounded-full bg-fr-purple/20 px-1.5 py-0.5 text-[10px] font-medium text-fr-purple">
                        TAP
                      </span>
                    ) : tappablePipelines.has(job.name) ? (
                      <Radio className="size-3.5 shrink-0 text-fr-purple/60" />
                    ) : null}
                    <span className="truncate">
                      {isTapJob(job.name) ? tapDisplayName(job.name) : job.name}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
                <TableCell className="text-right text-xs text-zinc-500">
                  {formatDistanceToNow(job.startTime, { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-400">
                  {formatDuration(getDuration(job))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {jobs.length > limit && (
        <Link
          to={href}
          className="flex items-center justify-center gap-1 border-t border-dash-border px-4 py-2 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          +{jobs.length - limit} more
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  )
}
