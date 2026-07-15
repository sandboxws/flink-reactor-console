import { createFileRoute, Link } from "@tanstack/react-router"
import { SubjectList } from "@/components/instruments/schemaregistry/subject-list"

/** Route: /instruments/$instrumentName/schema-registry — Schema Registry subject browser. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/schema-registry/",
)({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <SubjectList instrumentName={instrumentName} LinkComponent={Link} />
  },
})
