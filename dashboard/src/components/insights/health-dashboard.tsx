/**
 * @module health-dashboard
 * Cluster health dashboard page composing a circular score gauge, a trend chart,
 * a sub-category score grid, and a ranked issues list. Subscribes to
 * {@link useInsightsStore} for current health, history, and active issues.
 */
import { Skeleton } from "@flink-reactor/ui"
import { useInsightsStore } from "@/stores/insights-store"
import { HealthScoreGauge } from "./health-score-gauge"
import { HealthTrendChart } from "./health-trend-chart"
import { SubScoreGrid } from "./sub-score-grid"
import { TopIssuesList } from "./top-issues-list"

/** Placeholder skeleton shown while health data is loading. */
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card flex h-[260px] items-center justify-center">
          <Skeleton className="size-[200px] rounded-full" />
        </div>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {["slots", "backpressure", "checkpoints", "memory", "exceptions"].map(
          (name) => (
            <Skeleton key={name} className="h-24 w-full rounded-lg" />
          ),
        )}
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}

/**
 * Top-level cluster health page. Lays out a gauge (current score), a trend
 * chart (score over time), a grid of sub-category scores (slots, backpressure,
 * checkpoints, memory, exceptions), and a ranked list of active issues.
 */
export function HealthDashboard() {
  const currentHealth = useInsightsStore((s) => s.currentHealth)
  const healthHistory = useInsightsStore((s) => s.healthHistory)
  const issues = useInsightsStore((s) => s.issues)
  const healthLoading = useInsightsStore((s) => s.healthLoading)

  if (healthLoading && !currentHealth) {
    return <LoadingSkeleton />
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">Cluster Health</h1>

      {/* Top row: Gauge + Trend chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card flex items-center justify-center p-6">
          <HealthScoreGauge score={currentHealth?.score ?? 0} />
        </div>
        <HealthTrendChart history={healthHistory} />
      </div>

      {/* Sub-score grid */}
      {currentHealth && <SubScoreGrid subScores={currentHealth.subScores} />}

      {/* Issues list */}
      <TopIssuesList issues={issues} />
    </div>
  )
}
