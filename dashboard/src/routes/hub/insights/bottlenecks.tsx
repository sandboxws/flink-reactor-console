import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInsightsBottlenecks() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Insights" }, { label: "Bottlenecks" }]}
      phase="P3"
      description="Bottleneck analyzer — DAG view + table of vertices ranked by busy/backpressure time. Reuses BottleneckDAG + BottleneckTable."
    />
  )
}

export const Route = createFileRoute("/hub/insights/bottlenecks")({
  component: HubInsightsBottlenecks,
})
