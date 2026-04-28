import { RedisKeysRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/redis — Redis key browser. */
export const Route = createFileRoute("/instruments/$instrumentName/redis/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <RedisKeysRoute instrumentName={instrumentName} LinkComponent={Link} />
    )
  },
})
