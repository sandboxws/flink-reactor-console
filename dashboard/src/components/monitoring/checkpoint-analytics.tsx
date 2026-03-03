"use client"

import {
  CheckCircle2,
  Clock,
  Database,
  Hash,
  TriangleAlert,
} from "lucide-react"
import { MetricCard } from "@/components/shared/metric-card"
import { useCheckpointAnalyticsStore } from "@/stores/checkpoint-analytics-store"
import { useClusterStore } from "@/stores/cluster-store"
import { CheckpointJobTable } from "./checkpoint-job-table"
import { CheckpointTimelineChart } from "./checkpoint-timeline-chart"
import { StateSizeChart } from "./state-size-chart"

// Helpers

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Loading skeleton

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="h-6 w-48 animate-pulse rounded bg-white/[0.05]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["total", "rate", "duration", "size"].map((id) => (
          <div key={id} className="glass-card p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-white/[0.05]" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[290px] animate-pulse rounded-lg bg-white/[0.03]" />
        <div className="h-[290px] animate-pulse rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  )
}

// Empty state — no running jobs at all

function EmptyState() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">
        Checkpoint Analytics
      </h1>
      <div className="glass-card flex flex-col items-center justify-center gap-2 p-12 text-center">
        <Database className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-400">No running jobs</p>
        <p className="text-xs text-zinc-600">
          Checkpoint analytics require at least one running job with checkpoint
          data
        </p>
      </div>
    </div>
  )
}

// Empty state — jobs exist but checkpointing is not configured

function NotConfiguredState() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">
        Checkpoint Analytics
      </h1>
      <div className="glass-card flex flex-col items-center justify-center gap-2 p-12 text-center">
        <TriangleAlert className="size-8 text-fr-amber" />
        <p className="text-sm text-zinc-400">Checkpoints not configured</p>
        <p className="max-w-md text-xs text-zinc-600">
          None of the running jobs have periodic checkpointing enabled. Enable
          checkpointing in your Flink job configuration (e.g.{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 text-zinc-500">
            env.enableCheckpointing(60000)
          </code>
          ) to see analytics here.
        </p>
      </div>
    </div>
  )
}

// Main component

export function CheckpointAnalytics() {
  const loading = useCheckpointAnalyticsStore((s) => s.loading)
  const summaries = useCheckpointAnalyticsStore((s) => s.summaries)
  const timeline = useCheckpointAnalyticsStore((s) => s.timeline)
  const aggregates = useCheckpointAnalyticsStore((s) => s.aggregates)
  const checkpointsConfigured = useCheckpointAnalyticsStore(
    (s) => s.checkpointsConfigured,
  )
  const runningJobs = useClusterStore((s) => s.runningJobs)

  if (loading && !aggregates) return <LoadingSkeleton />
  if (runningJobs.length === 0) return <EmptyState />
  if (!loading && !checkpointsConfigured && !aggregates)
    return <NotConfiguredState />

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <h1 className="text-lg font-semibold text-zinc-100">
        Checkpoint Analytics
      </h1>

      {/* Summary metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Hash}
          label="Total Checkpoints"
          value={aggregates?.totalCheckpoints ?? 0}
          accent="text-fr-purple"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Success Rate"
          value={
            aggregates ? `${aggregates.overallSuccessRate.toFixed(1)}%` : "—"
          }
          accent={
            !aggregates
              ? "text-zinc-500"
              : aggregates.overallSuccessRate > 95
                ? "text-job-running"
                : aggregates.overallSuccessRate > 80
                  ? "text-fr-amber"
                  : "text-job-failed"
          }
        />
        <MetricCard
          icon={Clock}
          label="Avg Duration"
          value={aggregates ? formatDuration(aggregates.avgDuration) : "—"}
          accent="text-fr-amber"
        />
        <MetricCard
          icon={Database}
          label="Total State Size"
          value={aggregates ? formatBytes(aggregates.totalStateSize) : "—"}
          accent="text-fr-coral"
        />
      </div>

      {/* Per-job table */}
      <CheckpointJobTable summaries={summaries} />

      {/* Chart grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CheckpointTimelineChart timeline={timeline} />
        <StateSizeChart summaries={summaries} />
      </div>
    </div>
  )
}
