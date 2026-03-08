import { createFileRoute } from "@tanstack/react-router"
import { SchemaBrowser } from "@/components/instruments/database/schema-browser"

export const Route = createFileRoute("/instruments/$instrumentName/database/")({
  component: DatabaseIndexRoute,
})

function DatabaseIndexRoute() {
  const { instrumentName } = Route.useParams()
  return <SchemaBrowser instrumentName={instrumentName} />
}
