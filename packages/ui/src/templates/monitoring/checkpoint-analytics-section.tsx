"use client"

import { Activity, CheckCircle2, Clock, Database } from "lucide-react"
import { CheckpointTimelineChart } from "../../components/monitoring/checkpoint-timeline-chart"
import { CheckpointJobTable } from "../../components/monitoring/checkpoint-job-table"
import { MetricCard } from "../../shared/metric-card"
import type {
  JobCheckpointSummary,
  CheckpointTimelineEntry,
  CheckpointAggregates,
} from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CheckpointAnalyticsSectionProps {
  summaries: JobCheckpointSummary[]
  timeline: CheckpointTimelineEntry[]
  aggregates: CheckpointAggregates
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckpointAnalyticsSection({
  summaries,
  timeline,
  aggregates,
}: CheckpointAnalyticsSectionProps) {
  return (
    <section className="space-y-6 p-4">
      {/* Aggregate stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Total Checkpoints"
          value={aggregates.totalCheckpoints.toLocaleString()}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Success Rate"
          value={`${aggregates.overallSuccessRate.toFixed(1)}%`}
          accent={
            aggregates.overallSuccessRate > 95
              ? "text-job-running"
              : "text-fr-amber"
          }
        />
        <MetricCard
          icon={Clock}
          label="Avg Duration"
          value={formatDuration(aggregates.avgDuration)}
        />
        <MetricCard
          icon={Database}
          label="Total State"
          value={formatBytes(aggregates.totalStateSize)}
        />
      </div>

      {/* Timeline chart */}
      <CheckpointTimelineChart timeline={timeline} />

      {/* Per-job table */}
      <CheckpointJobTable summaries={summaries} />
    </section>
  )
}
