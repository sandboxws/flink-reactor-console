"use client"

import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  Server,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClusterStore } from "@/stores/cluster-store"
import { ClusterInfo } from "./cluster-info"
import { JobList } from "./job-list"
import { JobStatusSummary } from "./job-status-summary"
import { SlotUtilization } from "./slot-utilization"
import { StatCard } from "./stat-card"

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Cluster info bar */}
      <Skeleton className="h-8 w-64" />

      {/* Top row: 3 stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      {/* Second row: 2 panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>

      {/* Job tables */}
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  )
}

function OverviewError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-16 text-zinc-500">
      <AlertCircle className="size-10 text-red-400 opacity-60" />
      <p className="text-sm text-zinc-400">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 size-3.5" />
        Retry
      </Button>
    </div>
  )
}

export function OverviewPage() {
  const overview = useClusterStore((s) => s.overview)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const completedJobs = useClusterStore((s) => s.completedJobs)
  const fetchError = useClusterStore((s) => s.fetchError)
  const isLoading = useClusterStore((s) => s.isLoading)
  const refresh = useClusterStore((s) => s.refresh)

  // Loading: first fetch in progress, no data yet
  if (isLoading && !overview) {
    return <OverviewSkeleton />
  }

  // Error with no data: initial fetch failed
  if (fetchError && !overview) {
    return <OverviewError message={fetchError} onRetry={refresh} />
  }

  // No data and no error (shouldn't happen, but safe guard)
  if (!overview) return null

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Error banner: stale data visible underneath */}
      {fetchError && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            Connection error
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{fetchError}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-4 shrink-0 text-red-400 hover:text-red-300"
              onClick={refresh}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cluster info bar */}
      <ClusterInfo
        version={overview.flinkVersion}
        commitId={overview.flinkCommitId}
      />

      {/* Top row: key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Server}
          label="Active Task Managers"
          value={overview.taskManagerCount}
          accent="text-fr-purple"
        />
        <StatCard
          icon={Layers}
          label="Total Task Slots"
          value={overview.totalTaskSlots}
          accent="text-fr-coral"
        />
        <StatCard
          icon={Cpu}
          label="Available Slots"
          value={overview.availableTaskSlots}
          accent="text-job-running"
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

      {/* Job lists — full width */}
      <JobList
        title="Running Jobs"
        href="/jobs/running"
        icon={Play}
        jobs={runningJobs}
        accent="text-job-running"
      />
      <JobList
        title="Completed Jobs"
        href="/jobs/completed"
        icon={CheckCircle2}
        jobs={completedJobs}
        accent="text-job-finished"
      />
    </div>
  )
}
