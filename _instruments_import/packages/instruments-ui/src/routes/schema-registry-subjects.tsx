import { SubjectList } from "../components/schemaregistry/subject-list"

export function SchemaRegistrySubjectsRoute({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<{
    to: string
    search?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  return (
    <SubjectList
      instrumentName={instrumentName}
      LinkComponent={LinkComponent}
    />
  )
}
