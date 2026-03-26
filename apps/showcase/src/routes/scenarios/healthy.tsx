import { HealthScoreGauge, Separator } from "@flink-reactor/ui"
import { healthyCluster } from "@flink-reactor/ui/fixtures"
import { OverviewSection } from "@flink-reactor/ui/src/templates/overview/overview-section"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /scenarios/healthy -- Demonstrates components in a healthy cluster state with all systems nominal. */
function HealthyScenarioPage() {
  const scenario = healthyCluster()
  const running = scenario.jobs.filter((j) => j.status === "RUNNING")
  const completed = scenario.jobs.filter(
    (j) =>
      j.status === "FINISHED" ||
      j.status === "CANCELED" ||
      j.status === "FAILED",
  )

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Healthy Cluster</h1>
          <p className="mt-1 text-fg-muted">
            3 task managers, 2 running jobs, all systems nominal
          </p>
        </div>
        <HealthScoreGauge score={92} size={120} />
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-job-running/15 px-3 py-1 text-xs font-medium text-job-running">
          <span className="size-1.5 rounded-full bg-job-running" />
          All Systems Normal
        </span>
      </div>

      <Separator />

      <OverviewSection
        overview={scenario.overview}
        runningJobs={running}
        completedJobs={completed}
      />
    </div>
  )
}

export const Route = createFileRoute("/scenarios/healthy")({
  component: HealthyScenarioPage,
})
