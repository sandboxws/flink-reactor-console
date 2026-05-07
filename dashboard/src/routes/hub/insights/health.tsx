import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInsightsHealth() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Insights" }, { label: "Health" }]}
      phase="P3"
      description="Cluster health page — overall score, sub-score grid (4 dimensions), top issues, health trend chart. Reuses HealthScoreGauge + insights components."
    />
  )
}

export const Route = createFileRoute("/hub/insights/health")({
  component: HubInsightsHealth,
})
