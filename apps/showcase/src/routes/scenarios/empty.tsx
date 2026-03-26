import { EmptyState, HealthScoreGauge, Separator } from "@flink-reactor/ui"
import { emptyCluster } from "@flink-reactor/ui/fixtures"
import { OverviewSection } from "@flink-reactor/ui/src/templates/overview/overview-section"
import { createFileRoute } from "@tanstack/react-router"
import { Briefcase } from "lucide-react"

/** Showcase route: /scenarios/empty -- Demonstrates components in an empty cluster state with no deployed workloads. */
function EmptyScenarioPage() {
  const scenario = emptyCluster()

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Empty Cluster</h1>
          <p className="mt-1 text-fg-muted">
            Fresh cluster with 3 task managers, no deployed workloads
          </p>
        </div>
        <HealthScoreGauge score={100} size={120} />
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-job-running/15 px-3 py-1 text-xs font-medium text-job-running">
          <span className="size-1.5 rounded-full bg-job-running" />
          Idle — Ready for Workloads
        </span>
      </div>

      <Separator />

      <OverviewSection
        overview={scenario.overview}
        runningJobs={[]}
        completedJobs={[]}
      />

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-fg">Jobs</h2>
        <EmptyState
          icon={Briefcase}
          message="No jobs deployed. Submit a job to get started."
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/scenarios/empty")({
  component: EmptyScenarioPage,
})
