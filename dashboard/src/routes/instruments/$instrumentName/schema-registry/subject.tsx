import { createFileRoute } from "@tanstack/react-router"
import { SubjectDetail } from "@/components/instruments/schemaregistry/subject-detail"

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
    if (!subject) {
      return (
        <div className="glass-card p-4 text-sm text-zinc-500">
          No subject selected. Browse subjects to inspect a schema.
        </div>
      )
    }
    return <SubjectDetail instrumentName={instrumentName} subject={subject} />
  },
})
