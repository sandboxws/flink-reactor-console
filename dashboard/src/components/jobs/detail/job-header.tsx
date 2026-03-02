"use client"

import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Cpu,
  Layers,
  Save,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import type { FlinkJob } from "@/data/cluster-types"
import { cn } from "@/lib/cn"
import { useClusterStore } from "@/stores/cluster-store"

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
      <svg width={size} height={size} className="-rotate-90">
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

export function JobHeader({
  job,
  onCancelJob,
  onCreateSavepoint,
}: {
  job: FlinkJob
  onCancelJob?: () => void
  onCreateSavepoint?: () => void
}) {
  const featureFlags = useClusterStore((s) => s.featureFlags)
  const isRunning = job.status === "RUNNING"
  const canCancel = featureFlags?.webCancel !== false
  const taskTotal = Object.values(job.tasks).reduce((a, b) => a + b, 0)
  const taskFinished = job.tasks.finished
  const taskPct =
    taskTotal > 0 ? Math.round((taskFinished / taskTotal) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href={isRunning ? "/jobs/running" : "/jobs/completed"}
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        {isRunning ? "Running Jobs" : "Completed Jobs"}
      </Link>

      {/* Top row: name + badge + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-zinc-100">
              {job.name}
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
            <span className="text-xs text-zinc-500">—</span>
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
