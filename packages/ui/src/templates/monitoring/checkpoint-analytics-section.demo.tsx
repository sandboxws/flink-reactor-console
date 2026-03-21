"use client"

import {
  createJobCheckpointSummary,
  createCheckpointTimelineEntry,
  createCheckpointAggregates,
} from "../../fixtures"
import { CheckpointAnalyticsSection } from "./checkpoint-analytics-section"

const summaries = [
  createJobCheckpointSummary(),
  createJobCheckpointSummary({
    jobId: "job-002",
    jobName: "user-activity-aggregation",
    successRate: 97.5,
    avgDuration: 2_400,
    durationTrend: "increasing",
  }),
]

const now = Date.now()
const timeline = Array.from({ length: 24 }, (_, i) =>
  createCheckpointTimelineEntry({
    timestamp: new Date(now - (24 - i) * 3_600_000),
    successes: 8 + Math.floor(Math.random() * 4),
    failures: Math.random() > 0.9 ? 1 : 0,
  }),
)

const aggregates = createCheckpointAggregates()

export function CheckpointAnalyticsSectionDemo() {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-surface">
      <CheckpointAnalyticsSection
        summaries={summaries}
        timeline={timeline}
        aggregates={aggregates}
      />
    </div>
  )
}
