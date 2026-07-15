import { createFileRoute, Link } from "@tanstack/react-router"
import { SchemaBrowser } from "@/components/instruments/database/schema-browser"

/** Route: /instruments/$instrumentName/database — Instrument database schema browser. */
export const Route = createFileRoute("/instruments/$instrumentName/database/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <SchemaBrowser instrumentName={instrumentName} LinkComponent={Link} />
    )
  },
})
