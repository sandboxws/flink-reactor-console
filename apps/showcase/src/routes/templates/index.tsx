import { createFileRoute } from "@tanstack/react-router"
import { OverviewSectionDemo } from "@flink-reactor/ui/src/templates/overview/overview-section.demo"

function TemplatesPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Templates</h1>
      <p className="text-fg-muted">Page-level compositions with fixture data</p>
      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Overview Section</h2>
        <OverviewSectionDemo />
      </section>
    </div>
  )
}

export const Route = createFileRoute("/templates/")({
  component: TemplatesPage,
})
