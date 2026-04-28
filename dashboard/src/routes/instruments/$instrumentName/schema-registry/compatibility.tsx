import { SchemaRegistryCompatibilityRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/schema-registry/compatibility — Schema compatibility checker. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/schema-registry/compatibility",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <SchemaRegistryCompatibilityRoute instrumentName={instrumentName} />
    )
  },
})
