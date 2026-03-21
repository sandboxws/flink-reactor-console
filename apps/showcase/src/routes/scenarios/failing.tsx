import {
  Alert,
  AlertDescription,
  AlertTitle,
  HealthScoreGauge,
  Separator,
} from "@flink-reactor/ui"
import {
  createErrorGroup,
  createHealthSnapshot,
  failingCluster,
} from "@flink-reactor/ui/fixtures"
import { ErrorExplorerSection } from "@flink-reactor/ui/src/templates/errors/error-explorer-section"
import { BottleneckSection } from "@flink-reactor/ui/src/templates/insights/bottleneck-section"
import { HealthDashboardSection } from "@flink-reactor/ui/src/templates/insights/health-dashboard-section"
import { OverviewSection } from "@flink-reactor/ui/src/templates/overview/overview-section"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircle } from "lucide-react"

function FailingScenarioPage() {
  const scenario = failingCluster()
  const running = scenario.jobs.filter((j) => j.status === "RUNNING")
  const completed = scenario.jobs.filter(
    (j) =>
      j.status === "FINISHED" ||
      j.status === "CANCELED" ||
      j.status === "FAILED",
  )

  // Build a declining health history
  const history = [
    createHealthSnapshot({
      score: 78,
      timestamp: new Date(Date.now() - 3_600_000 * 4),
    }),
    createHealthSnapshot({
      score: 62,
      timestamp: new Date(Date.now() - 3_600_000 * 3),
    }),
    createHealthSnapshot({
      score: 50,
      timestamp: new Date(Date.now() - 3_600_000 * 2),
    }),
    createHealthSnapshot({
      score: 42,
      timestamp: new Date(Date.now() - 3_600_000),
    }),
    scenario.health,
  ]

  // Build error groups from the failed job's exceptions
  const failedJob = scenario.jobs.find((j) => j.status === "FAILED")
  const errorGroups = failedJob?.exceptions
    ? [
        createErrorGroup({
          exceptionClass: "java.lang.OutOfMemoryError",
          message: "Java heap space — Aggregate: SUM(amount)",
          count: 1,
        }),
      ]
    : []

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Failing Cluster</h1>
          <p className="mt-1 text-fg-muted">
            OOM failure on user-activity-aggregation, critical health score
          </p>
        </div>
        <HealthScoreGauge score={35} size={120} />
      </div>

      {/* Critical issues */}
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
        <h2 className="mb-4 text-lg font-semibold text-fg">Error Explorer</h2>
        <ErrorExplorerSection errors={errorGroups} />
      </div>

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

export const Route = createFileRoute("/scenarios/failing")({
  component: FailingScenarioPage,
})
