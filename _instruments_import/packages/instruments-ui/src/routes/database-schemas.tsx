import { SchemaBrowser } from "../components/database/schema-browser"

export function DatabaseSchemasRoute({
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
    <SchemaBrowser
      instrumentName={instrumentName}
      LinkComponent={LinkComponent}
    />
  )
}
