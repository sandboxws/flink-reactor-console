"use client"

/**
 * OverviewSection — Full overview dashboard section.
 *
 * Composes the overview domain components into a complete page section:
 * stat cards (task managers, slots, available), slot utilization, job status
 * summary, and mini job lists for running + completed jobs.
 *
 * Accepts pure data props — no stores, no router. Suitable for embedding
 * in any React application or copying as a starting point.
 */

import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  Server,
} from "lucide-react"
import type {
  ClusterOverview,
  FlinkFeatureFlags,
  FlinkJob,
} from "../../types"
import { Button } from "../../components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Skeleton } from "../../components/ui/skeleton"
import { StatCard } from "../../components/overview/stat-card"
import { SlotUtilization } from "../../components/overview/slot-utilization"
import { JobStatusSummary } from "../../components/overview/job-status-summary"
import { JobStatusBadge } from "../../shared/job-status-badge"
import { DurationCell } from "../../shared/duration-cell"
import { formatDuration } from "../../lib/format"

// ---------------------------------------------------------------------------
// Mini job list (router-free version of dashboard's JobList)
// ---------------------------------------------------------------------------

function MiniJobList({
  title,
  icon: Icon,
  jobs,
  accent,
  onJobClick,
  limit = 5,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  jobs: FlinkJob[]
  accent?: string
  onJobClick?: (jobId: string) => void
  limit?: number
}) {
  const visible = jobs.slice(0, limit)

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-zinc-500">
        <Icon className={`size-4 ${accent ?? ""}`} />
        <span className="text-xs font-medium uppercase tracking-wide">
          {title}
        </span>
        <span className="text-xs tabular-nums">{jobs.length}</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-zinc-600">No jobs</p>
      ) : (
        <div className="flex flex-col">
          {visible.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onJobClick?.(job.id)}
              className="data-row flex items-center justify-between px-4 py-2 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-zinc-200">
                  {job.name}
                </span>
                <JobStatusBadge status={job.status} />
              </div>
              <DurationCell
                startTime={job.startTime}
                endTime={job.endTime}
                isRunning={job.status === "RUNNING"}
              />
            </button>
          ))}
        </div>
      )}

      {jobs.length > limit && (
        <div className="border-t border-dash-border px-4 py-2 text-center text-xs text-zinc-600">
          +{jobs.length - limit} more
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// OverviewSection
// ---------------------------------------------------------------------------

export function OverviewSection({
  overview,
  runningJobs,
  completedJobs,
  featureFlags,
  onJobClick,
  onRefresh,
  isLoading,
  error,
}: {
  overview: ClusterOverview
  runningJobs: FlinkJob[]
  completedJobs: FlinkJob[]
  featureFlags?: FlinkFeatureFlags
  onJobClick?: (jobId: string) => void
  onRefresh?: () => void
  isLoading?: boolean
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            Connection error
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-4 shrink-0 text-red-400 hover:text-red-300"
                onClick={onRefresh}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Top row: key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Play}
          label="Running Jobs"
          value={overview.runningJobs}
          accent="text-job-running"
        />
        <StatCard
          icon={CheckCircle2}
          label="Finished Jobs"
          value={overview.finishedJobs}
          accent="text-job-finished"
        />
        <StatCard
          icon={Server}
          label="Task Managers"
          value={overview.taskManagerCount}
          accent="text-fr-purple"
        />
        <StatCard
          icon={Layers}
          label="Total Slots"
          value={overview.totalTaskSlots}
          accent="text-fr-coral"
        />
      </div>

      {/* Second row: utilization + job status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SlotUtilization
          available={overview.availableTaskSlots}
          total={overview.totalTaskSlots}
        />
        <JobStatusSummary
          running={overview.runningJobs}
          finished={overview.finishedJobs}
          cancelled={overview.cancelledJobs}
          failed={overview.failedJobs}
        />
      </div>

      {/* Job lists */}
      <MiniJobList
        title="Running Jobs"
        icon={Play}
        jobs={runningJobs}
        accent="text-job-running"
        onJobClick={onJobClick}
      />
      <MiniJobList
        title="Completed Jobs"
        icon={CheckCircle2}
        jobs={completedJobs}
        accent="text-job-finished"
        onJobClick={onJobClick}
      />
    </div>
  )
}
