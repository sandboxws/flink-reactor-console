import { FlussTablesRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/fluss — Fluss database/table browser. */
export const Route = createFileRoute("/instruments/$instrumentName/fluss/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <FlussTablesRoute
        instrumentName={instrumentName}
        LinkComponent={Link}
      />
    )
  },
})
