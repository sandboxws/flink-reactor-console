import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubInstrumentRedis() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Instruments", to: "/hub/instruments" },
        { label: "Redis" },
      ]}
      phase="P4"
      description="Redis instrument — primary/replica topology, key inspector, server stats."
    />
  )
}

export const Route = createFileRoute("/hub/instruments/redis")({
  component: HubInstrumentRedis,
})
