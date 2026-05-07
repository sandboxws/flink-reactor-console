import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInstrumentDatabase() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Instruments", to: "/hub/instruments" },
        { label: "Database" },
      ]}
      phase="P4"
      description="Datalake / Paimon instrument — catalog browser, table query, write health."
    />
  )
}

export const Route = createFileRoute("/hub/instruments/database")({
  component: HubInstrumentDatabase,
})
