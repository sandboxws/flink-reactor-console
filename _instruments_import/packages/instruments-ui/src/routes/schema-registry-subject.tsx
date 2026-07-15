import { SubjectDetail } from "../components/schemaregistry/subject-detail"

export function SchemaRegistrySubjectRoute({
  instrumentName,
  subject,
}: {
  instrumentName: string
  subject: string
}) {
  if (!subject) {
    return (
      <div className="glass-card p-4 text-sm text-zinc-500">
        No subject selected. Browse subjects to inspect a schema.
      </div>
    )
  }
  return <SubjectDetail instrumentName={instrumentName} subject={subject} />
}
