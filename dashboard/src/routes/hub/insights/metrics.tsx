import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInsightsMetrics() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Insights" }, { label: "Metrics" }]}
      phase="P3"
      description="Metrics explorer — query the metricSeries / metricHistory GraphQL endpoints, build composable charts. Reuses MetricChart + the existing metrics-explorer-store."
    />
  )
}

export const Route = createFileRoute("/hub/insights/metrics")({
  component: HubInsightsMetrics,
})
