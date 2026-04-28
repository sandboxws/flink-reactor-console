import { SchemaRegistrySubjectsRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

/** Route: /instruments/$instrumentName/schema-registry — Schema Registry subject browser. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/schema-registry/",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return (
      <SchemaRegistrySubjectsRoute
        instrumentName={instrumentName}
        LinkComponent={Link}
      />
    )
  },
})
