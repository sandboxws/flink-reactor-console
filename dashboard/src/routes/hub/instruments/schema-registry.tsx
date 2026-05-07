import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInstrumentSchemaRegistry() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Instruments", to: "/hub/instruments" },
        { label: "Schema registry" },
      ]}
      phase="P4"
      description="Schema registry — subjects, versions, compatibility check, side-by-side schema diff (uses the new DiffViewer primitive)."
    />
  )
}

export const Route = createFileRoute("/hub/instruments/schema-registry")({
  component: HubInstrumentSchemaRegistry,
})
