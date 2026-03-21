"use client"

import { HealthScoreGauge } from "../../shared/health-score-gauge"
import { HealthTrendChart } from "../../components/insights/health-trend-chart"
import { SubScoreGrid } from "../../components/insights/sub-score-grid"
import { TopIssuesList } from "../../components/insights/top-issues-list"
import type { HealthSnapshot, HealthIssue } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HealthDashboardSectionProps {
  snapshot: HealthSnapshot
  history: HealthSnapshot[]
  issues: HealthIssue[]
}

// ---------------------------------------------------------------------------
// Status label
// ---------------------------------------------------------------------------

function statusLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Healthy", color: "text-job-running" }
  if (score >= 50) return { text: "Degraded", color: "text-fr-amber" }
  return { text: "Critical", color: "text-job-failed" }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthDashboardSection({
  snapshot,
  history,
  issues,
}: HealthDashboardSectionProps) {
  const status = statusLabel(snapshot.score)

  return (
    <section className="space-y-6 p-4">
      {/* Top row: gauge + status + trend chart */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-2">
          <HealthScoreGauge score={snapshot.score} size={160} />
          <span className={`text-xs font-medium ${status.color}`}>
            {status.text}
          </span>
        </div>
        <HealthTrendChart history={history} />
      </div>

      {/* Sub-score grid */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Sub-Scores
        </h3>
        <SubScoreGrid subScores={snapshot.subScores} />
      </div>

      {/* Active issues */}
      <TopIssuesList issues={issues} />
    </section>
  )
}
