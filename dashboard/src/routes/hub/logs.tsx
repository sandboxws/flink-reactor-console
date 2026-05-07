import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubLogs() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Logs" }]}
      phase="P2"
      description="Real-time log explorer with severity filtering, source filtering (TM/JM/SQL Gateway), regex search, time-range scoping, histogram. Reuses LogExplorer from @flink-reactor/ui."
    />
  )
}

export const Route = createFileRoute("/hub/logs")({
  component: HubLogs,
})
