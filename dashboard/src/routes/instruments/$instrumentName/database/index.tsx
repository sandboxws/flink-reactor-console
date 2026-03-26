import { DatabaseSchemasRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/database — Instrument database schema browser. */
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
