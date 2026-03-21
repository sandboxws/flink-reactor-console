import {
  Alert,
  AlertDescription,
  AlertTitle,
  HealthScoreGauge,
  Separator,
} from "@flink-reactor/ui"
import {
  createHealthSnapshot,
  degradedCluster,
} from "@flink-reactor/ui/fixtures"
import { BottleneckSection } from "@flink-reactor/ui/src/templates/insights/bottleneck-section"
import { HealthDashboardSection } from "@flink-reactor/ui/src/templates/insights/health-dashboard-section"
import { OverviewSection } from "@flink-reactor/ui/src/templates/overview/overview-section"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircle } from "lucide-react"

function DegradedScenarioPage() {
  const scenario = degradedCluster()
  const running = scenario.jobs.filter((j) => j.status === "RUNNING")
  const completed = scenario.jobs.filter(
    (j) =>
      j.status === "FINISHED" ||
      j.status === "CANCELED" ||
      j.status === "FAILED",
  )

  // Build a short history for the health trend chart
  const history = [
    createHealthSnapshot({
      score: 88,
      timestamp: new Date(Date.now() - 3_600_000 * 4),
    }),
    createHealthSnapshot({
      score: 82,
      timestamp: new Date(Date.now() - 3_600_000 * 3),
    }),
    createHealthSnapshot({
      score: 74,
      timestamp: new Date(Date.now() - 3_600_000 * 2),
    }),
    createHealthSnapshot({
      score: 68,
      timestamp: new Date(Date.now() - 3_600_000),
    }),
    scenario.health,
  ]

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Degraded Cluster</h1>
          <p className="mt-1 text-fg-muted">
            Elevated backpressure, checkpoint delays, declining health
          </p>
        </div>
        <HealthScoreGauge score={65} size={120} />
      </div>

      {/* Active issues */}
      {scenario.issues.length > 0 && (
        <div className="flex flex-col gap-2">
          {scenario.issues.map((issue) => (
            <Alert key={issue.id} variant="destructive">
              <AlertTitle className="flex items-center gap-2">
                <AlertCircle className="size-4" />
                {issue.severity === "critical" ? "Critical" : "Warning"}
              </AlertTitle>
              <AlertDescription>{issue.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Separator />

      <OverviewSection
        overview={scenario.overview}
        runningJobs={running}
        completedJobs={completed}
      />

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-fg">Health Dashboard</h2>
        <HealthDashboardSection
          snapshot={scenario.health}
          history={history}
          issues={scenario.issues}
        />
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-fg">
          Bottleneck Analysis
        </h2>
        <BottleneckSection
          bottlenecks={scenario.bottlenecks}
          recommendations={scenario.recommendations}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/scenarios/degraded")({
  component: DegradedScenarioPage,
})
