import { createFileRoute } from "@tanstack/react-router"
import { QueryEditor } from "@/components/instruments/database/query-editor"

/** Route: /instruments/$instrumentName/database/query — SQL query editor for instrument database. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/database/query",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <QueryEditor instrumentName={instrumentName} />
  },
})
