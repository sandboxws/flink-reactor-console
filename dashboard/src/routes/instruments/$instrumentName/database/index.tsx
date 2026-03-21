import { DatabaseSchemasRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/instruments/$instrumentName/database/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <DatabaseSchemasRoute
        instrumentName={instrumentName}
        LinkComponent={Link}
      />
    )
  },
})
