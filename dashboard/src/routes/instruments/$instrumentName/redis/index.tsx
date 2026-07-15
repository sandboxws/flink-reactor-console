import { createFileRoute, Link } from "@tanstack/react-router"
import { KeyBrowser } from "@/components/instruments/redis/key-browser"

/** Route: /instruments/$instrumentName/redis — Redis key browser. */
export const Route = createFileRoute("/instruments/$instrumentName/redis/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <KeyBrowser instrumentName={instrumentName} LinkComponent={Link} />
  },
})
