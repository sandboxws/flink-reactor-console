import { SchemaRegistrySubjectRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

type SubjectSearch = {
  subject: string
}

/** Route: /instruments/$instrumentName/schema-registry/subject — Subject detail with version timeline. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/schema-registry/subject",
)({
  validateSearch: (search: Record<string, unknown>): SubjectSearch => ({
    subject: (search.subject as string) ?? "",
  }),
  component: () => {
    const { instrumentName } = Route.useParams()
    const { subject } = Route.useSearch()
    return (
      <SchemaRegistrySubjectRoute
        instrumentName={instrumentName}
        subject={subject}
      />
    )
  },
})
