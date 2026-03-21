import { DatabaseQueryRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/instruments/$instrumentName/database/query",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <DatabaseQueryRoute instrumentName={instrumentName} />
  },
})
