import { JmDetailSectionDemo } from "@flink-reactor/ui/src/templates/job-manager/jm-detail-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/job-manager -- Demonstrates the job manager detail template section with configuration and metrics. */
function JobManagerTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Job Manager Template</h1>
        <p className="mt-1 text-fg-muted">
          Job manager detail view with configuration and metrics
        </p>
      </div>
      <JmDetailSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/job-manager")({
  component: JobManagerTemplatePage,
})
