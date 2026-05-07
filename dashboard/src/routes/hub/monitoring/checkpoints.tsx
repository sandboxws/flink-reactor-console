import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubMonitoringCheckpoints() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Monitoring" }, { label: "Checkpoints" }]}
      phase="P3"
      description="Checkpoint analytics — 26-week density heatmap, per-job timeline charts, state size trends. Reuses CheckpointTimelineChart + the new HeatmapCalendar primitive."
    />
  )
}

export const Route = createFileRoute("/hub/monitoring/checkpoints")({
  component: HubMonitoringCheckpoints,
})
