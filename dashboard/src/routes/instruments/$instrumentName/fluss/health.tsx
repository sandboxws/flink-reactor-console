import { FlussHealthRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/fluss/health — TabletServer/Coordinator/ZK status grid. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/fluss/health",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <FlussHealthRoute instrumentName={instrumentName} />
  },
})
