import { createFileRoute, Link } from "@tanstack/react-router"
import { FlussTableBrowser } from "@/components/instruments/fluss/fluss-table-browser"

/** Route: /instruments/$instrumentName/fluss — Fluss database/table browser. */
export const Route = createFileRoute("/instruments/$instrumentName/fluss/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <FlussTableBrowser instrumentName={instrumentName} LinkComponent={Link} />
    )
  },
})
