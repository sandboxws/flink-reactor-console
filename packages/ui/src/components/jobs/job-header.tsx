/** Job detail page header -- shows job name, status badge, timing info, and action buttons. */
"use client"

import { Badge } from "../../components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Cpu,
  Layers,
  Radio,
  RefreshCw,
  Save,
  Square,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { FlinkFeatureFlags, FlinkJob } from "../../types"
import { cn } from "../../lib/cn"

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tap job detection
// ---------------------------------------------------------------------------

const TAP_JOB_PREFIX = "fr-tap-"

function isTapJob(name: string): boolean {
  return name.startsWith(TAP_JOB_PREFIX)
}

function tapDisplayName(name: string): string {
  return name.slice(TAP_JOB_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Explore job detection
// ---------------------------------------------------------------------------

const EXPLORE_JOB_PREFIX = "explore: "

function isExploreJob(name: string): boolean {
  return name.startsWith(EXPLORE_JOB_PREFIX)
}

function exploreDisplayName(name: string): string {
  return name.slice(EXPLORE_JOB_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ---------------------------------------------------------------------------
// Live duration (per-cell timer pattern from DurationCell)
// ---------------------------------------------------------------------------

function LiveDuration({ startTime }: { startTime: Date }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono text-sm text-zinc-200">
      {formatDuration(now - startTime.getTime())}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Copy-on-click job ID (pattern from JobIdCell)
// ---------------------------------------------------------------------------

function CopyableJobId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-1.5 font-mono text-xs text-zinc-600 transition-colors hover:text-zinc-400"
      title="Copy job ID"
    >
      <span className="truncate">{id}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-job-running" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// SVG progress ring
// ---------------------------------------------------------------------------

function ProgressRing({
  percentage,
  size = 48,
  strokeWidth = 4,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-job-running)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-medium tabular-nums text-zinc-300">
        {percentage}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="glass-card flex flex-col gap-1 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="text-sm text-zinc-200">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JobHeader
// ---------------------------------------------------------------------------

/** Full-width header for a single job detail page -- renders name, status badge, live/static duration, progress ring, parallelism/task stats, and action buttons (cancel, stop, savepoint). */
export function JobHeader({
  job,
  featureFlags,
  tappablePipelines,
  onBack,
  onCancelJob,
  onCreateSavepoint,
  onStopWithSavepoint,
  onRefresh,
  isRefreshing,
}: {
  job: FlinkJob
  /** Feature flags from cluster store — controls whether cancel button is shown */
  featureFlags?: FlinkFeatureFlags | null
  /** Set of pipeline names that are tappable */
  tappablePipelines?: Set<string>
  /** Called when user clicks the back link */
  onBack?: () => void
  onCancelJob?: () => void
  onCreateSavepoint?: () => void
  onStopWithSavepoint?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}) {
  const isRunning = job.status === "RUNNING"
  const isCanceled = job.status === "CANCELED"
  const canCancel = featureFlags?.webCancel !== false
  const taskTotal = Object.values(job.tasks).reduce((a, b) => a + b, 0)
  const taskFinished = job.tasks.finished
  const taskPct =
    taskTotal > 0 ? Math.round((taskFinished / taskTotal) * 100) : 0
  const tappable = tappablePipelines ?? new Set<string>()

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="size-3" />
          {isRunning ? "Running Jobs" : "Completed Jobs"}
        </button>
      )}

      {/* Top row: name + badge + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {isTapJob(job.name) ? (
              <span className="shrink-0 rounded-full bg-fr-purple/20 px-2 py-0.5 text-xs font-medium text-fr-purple">
                TAP
              </span>
            ) : isExploreJob(job.name) ? (
              <span className="shrink-0 rounded-full bg-fr-coral/20 px-2 py-0.5 text-xs font-medium text-fr-coral">
                EXPLORE
              </span>
            ) : tappable.has(job.name) ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-fr-purple/10 px-2 py-0.5 text-xs font-medium text-fr-purple/70">
                <Radio className="size-3" />
                Tappable
              </span>
            ) : null}
            <h1 className="truncate text-lg font-semibold text-zinc-100">
              {isTapJob(job.name)
                ? tapDisplayName(job.name)
                : isExploreJob(job.name)
                  ? exploreDisplayName(job.name)
                  : job.name}
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 border-0 text-xs",
                statusColor[job.status],
              )}
            >
              {job.status}
            </Badge>
          </div>
          <CopyableJobId id={job.id} />
          <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="size-3" />
            {isRunning ? (
              <LiveDuration startTime={job.startTime} />
            ) : (
              <span className="font-mono text-sm text-zinc-200">
                {formatDuration(job.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Progress ring + quick actions */}
        <div className="flex items-center gap-3">
          {!isCanceled && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-dash-panel hover:text-zinc-200 disabled:pointer-events-none"
              title="Refresh job data"
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
            </button>
          )}
          {isRunning && <ProgressRing percentage={taskPct} />}
          {isRunning && (
            <div className="flex gap-2">
              {canCancel && (
                <button
                  type="button"
                  onClick={onCancelJob}
                  className="flex items-center gap-1.5 rounded-md bg-job-failed/10 px-3 py-1.5 text-xs font-medium text-job-failed transition-colors hover:bg-job-failed/20"
                >
                  <XCircle className="size-3.5" />
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={onStopWithSavepoint}
                className="flex items-center gap-1.5 rounded-md bg-fr-amber/10 px-3 py-1.5 text-xs font-medium text-fr-amber transition-colors hover:bg-fr-amber/20"
              >
                <Square className="size-3.5" />
                Stop
              </button>
              <button
                type="button"
                onClick={onCreateSavepoint}
                className="flex items-center gap-1.5 rounded-md bg-fr-amber/10 px-3 py-1.5 text-xs font-medium text-fr-amber transition-colors hover:bg-fr-amber/20"
              >
                <Save className="size-3.5" />
                Savepoint
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard label="Start Time" icon={Clock}>
          <span className="font-mono text-xs">
            {format(job.startTime, "yyyy-MM-dd HH:mm:ss")}
          </span>
          <span className="ml-1 text-[10px] text-zinc-500">
            ({formatDistanceToNow(job.startTime, { addSuffix: true })})
          </span>
        </StatCard>
        <StatCard label="End Time" icon={Clock}>
          {job.endTime ? (
            <span className="font-mono text-xs">
              {format(job.endTime, "yyyy-MM-dd HH:mm:ss")}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">&mdash;</span>
          )}
        </StatCard>
        <StatCard label="Parallelism" icon={Cpu}>
          {job.parallelism}
        </StatCard>
        <StatCard label="Total Tasks" icon={Layers}>
          {taskTotal}
        </StatCard>
      </div>
    </div>
  )
}
