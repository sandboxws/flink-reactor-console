import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubErrors() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Errors" }]}
      phase="P2"
      description="Exception aggregator grouped by stack trace fingerprint. Reuses ErrorExplorer from @flink-reactor/ui."
    />
  )
}

export const Route = createFileRoute("/hub/errors")({
  component: HubErrors,
})
