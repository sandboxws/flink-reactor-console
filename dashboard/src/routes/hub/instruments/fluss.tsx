import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInstrumentFluss() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Instruments", to: "/hub/instruments" },
        { label: "Fluss" },
      ]}
      phase="P4"
      description="Fluss instrument — server health, table list, schema, replication state."
    />
  )
}

export const Route = createFileRoute("/hub/instruments/fluss")({
  component: HubInstrumentFluss,
})
