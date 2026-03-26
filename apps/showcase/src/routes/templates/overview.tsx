import { OverviewSectionDemo } from "@flink-reactor/ui/src/templates/overview/overview-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/overview -- Demonstrates the full cluster overview template section with fixture data. */
function OverviewTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Overview Template</h1>
        <p className="mt-1 text-fg-muted">
          Full cluster overview section with fixture data
        </p>
      </div>
      <OverviewSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/overview")({
  component: OverviewTemplatePage,
})
