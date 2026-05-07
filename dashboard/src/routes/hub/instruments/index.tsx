import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInstruments() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Instruments" }]}
      phase="P4"
      description="Instruments grid — Fluss / Redis / Schema Registry / Database health cards. Drill-down routes per instrument follow."
    />
  )
}

export const Route = createFileRoute("/hub/instruments/")({
  component: HubInstruments,
})
