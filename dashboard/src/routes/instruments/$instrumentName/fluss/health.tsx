import { createFileRoute } from "@tanstack/react-router"
import { FlussTabletServerHealth } from "@/components/instruments/fluss/fluss-tablet-server-health"

/** Route: /instruments/$instrumentName/fluss/health — TabletServer/Coordinator/ZK status grid. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/fluss/health",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <FlussTabletServerHealth instrumentName={instrumentName} />
  },
})
