import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubDeployments() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Deployments" }]}
      phase="P3"
      description="Blue-green deployments kanban board (5 columns matching console-v2/deployments.html: Pending / Validating / Rolling out / Rolling back / Complete). Reads from useBgDeploymentStore."
    />
  )
}

export const Route = createFileRoute("/hub/deployments/")({
  component: HubDeployments,
})
