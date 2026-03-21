"use client"

import type { ActiveAlert } from "../../types"
import { AlertsSection } from "./alerts-section"

const alerts: ActiveAlert[] = [
  {
    id: "alert-1",
    ruleId: "rule-bp-high",
    ruleName: "High Backpressure",
    severity: "critical",
    message: "Vertex 'Aggregate: SUM(amount)' backpressure ratio > 0.8 for 5 minutes",
    currentValue: 0.85,
    threshold: 0.8,
    triggeredAt: new Date(Date.now() - 300_000),
    acknowledged: false,
  },
  {
    id: "alert-2",
    ruleId: "rule-ckpt-dur",
    ruleName: "Checkpoint Duration Spike",
    severity: "warning",
    message: "Average checkpoint duration exceeded 5s threshold",
    currentValue: 6.2,
    threshold: 5,
    triggeredAt: new Date(Date.now() - 600_000),
    acknowledged: false,
  },
  {
    id: "alert-3",
    ruleId: "rule-heap",
    ruleName: "Heap Utilization Warning",
    severity: "warning",
    message: "TM-1 JVM heap usage at 88%",
    currentValue: 88,
    threshold: 85,
    triggeredAt: new Date(Date.now() - 120_000),
    acknowledged: true,
  },
  {
    id: "alert-4",
    ruleId: "rule-restart",
    ruleName: "Job Restart Detected",
    severity: "info",
    message: "Job 'user-activity-aggregation' restarted (attempt 2)",
    currentValue: 2,
    threshold: 1,
    triggeredAt: new Date(Date.now() - 900_000),
    acknowledged: false,
  },
]

export function AlertsSectionDemo() {
  return (
    <div className="max-w-4xl rounded-lg border border-dash-border bg-dash-surface">
      <AlertsSection alerts={alerts} />
    </div>
  )
}
