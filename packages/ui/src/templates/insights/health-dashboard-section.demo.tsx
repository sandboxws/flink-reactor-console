"use client"

import { createHealthSnapshot, createHealthIssue } from "../../fixtures"
import { HealthDashboardSection } from "./health-dashboard-section"

const snapshot = createHealthSnapshot({ score: 78 })

const now = Date.now()
const history = Array.from({ length: 30 }, (_, i) =>
  createHealthSnapshot({
    timestamp: new Date(now - (30 - i) * 60_000),
    score: 75 + Math.random() * 15,
  }),
)

const issues = [
  createHealthIssue({
    severity: "warning",
    message: "Vertex 'Aggregate: SUM(amount)' showing elevated backpressure (ratio: 0.65)",
    source: "backpressure-monitor",
  }),
  createHealthIssue({
    id: "issue-2",
    severity: "info",
    message: "Checkpoint duration trending upward over last 30 minutes",
    source: "checkpoint-monitor",
  }),
]

/** Standalone demo of the health dashboard section with fixture snapshot, history, and issues. */
export function HealthDashboardSectionDemo() {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-surface">
      <HealthDashboardSection
        snapshot={snapshot}
        history={history}
        issues={issues}
      />
    </div>
  )
}
