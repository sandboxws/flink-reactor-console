import { TableDetail } from "../components/database/table-detail"

export function DatabaseTableRoute({
  instrumentName,
  schema,
  table,
}: {
  instrumentName: string
  schema: string
  table: string
}) {
  if (!schema || !table) {
    return (
      <div className="glass-card p-4 text-sm text-zinc-500">
        No table selected. Browse schemas to select a table.
      </div>
    )
  }
  return (
    <TableDetail
      instrumentName={instrumentName}
      schema={schema}
      table={table}
    />
  )
}
