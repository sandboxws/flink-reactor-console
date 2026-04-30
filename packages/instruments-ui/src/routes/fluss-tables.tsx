import { FlussTableBrowser } from "../components/fluss/fluss-table-browser"

export function FlussTablesRoute({
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
    <FlussTableBrowser
      instrumentName={instrumentName}
      LinkComponent={LinkComponent}
    />
  )
}
