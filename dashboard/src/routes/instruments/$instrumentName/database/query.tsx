import { createFileRoute } from "@tanstack/react-router"
import { QueryEditor } from "@/components/instruments/database/query-editor"

export const Route = createFileRoute(
  "/instruments/$instrumentName/database/query",
)({
  component: DatabaseQueryRoute,
})

function DatabaseQueryRoute() {
  const { instrumentName } = Route.useParams()
  return <QueryEditor instrumentName={instrumentName} />
}
