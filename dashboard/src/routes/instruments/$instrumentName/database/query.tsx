import { DatabaseQueryRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/database/query — SQL query editor for instrument database. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/database/query",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <DatabaseQueryRoute instrumentName={instrumentName} />
  },
})
