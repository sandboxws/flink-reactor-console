import { RedisServerRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/redis/server — Redis server dashboard and memory chart. */
export const Route = createFileRoute("/instruments/$instrumentName/redis/server")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <RedisServerRoute instrumentName={instrumentName} />
  },
})
