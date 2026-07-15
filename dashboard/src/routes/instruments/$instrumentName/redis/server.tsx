import { createFileRoute } from "@tanstack/react-router"
import { MemoryChart } from "@/components/instruments/redis/memory-chart"
import { ServerDashboard } from "@/components/instruments/redis/server-dashboard"

/** Route: /instruments/$instrumentName/redis/server — Redis server dashboard and memory chart. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/redis/server",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <div className="space-y-4">
        <ServerDashboard instrumentName={instrumentName} />
        <MemoryChart instrumentName={instrumentName} />
      </div>
    )
  },
})
