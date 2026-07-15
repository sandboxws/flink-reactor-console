import { createFileRoute } from "@tanstack/react-router"
import { CompatibilityChecker } from "@/components/instruments/schemaregistry/compatibility-checker"

/** Route: /instruments/$instrumentName/schema-registry/compatibility — Schema compatibility checker. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/schema-registry/compatibility",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <CompatibilityChecker instrumentName={instrumentName} />
  },
})
