import { PlanAnalyzerSectionDemo } from "@flink-reactor/ui/src/templates/plan-analyzer/plan-analyzer-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/plan-analyzer -- Demonstrates the plan analyzer template section with anti-pattern detection and state growth forecasts. */
function PlanAnalyzerTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">
          Plan Analyzer Template
        </h1>
        <p className="mt-1 text-fg-muted">
          Query plan analysis with anti-pattern detection and state growth
          forecasts
        </p>
      </div>
      <PlanAnalyzerSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/plan-analyzer")({
  component: PlanAnalyzerTemplatePage,
})
