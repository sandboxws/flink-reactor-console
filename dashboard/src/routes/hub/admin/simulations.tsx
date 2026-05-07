import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubAdminSimulations() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Admin" }, { label: "Simulations" }]}
      phase="P4"
      description="Simulation runs — sparkbar histogram of pass/fail/skip outcomes, run timeline, replay-from-savepoint controls. Reads from useSimulationStore."
    />
  )
}

export const Route = createFileRoute("/hub/admin/simulations")({
  component: HubAdminSimulations,
})
