import { createFileRoute } from "@tanstack/react-router"
import { TableDetail } from "@/components/instruments/database/table-detail"

type TableSearch = {
  schema: string
  table: string
}

export const Route = createFileRoute(
  "/instruments/$instrumentName/database/table",
)({
  validateSearch: (search: Record<string, unknown>): TableSearch => ({
    schema: (search.schema as string) ?? "",
    table: (search.table as string) ?? "",
  }),
  component: DatabaseTableRoute,
})

function DatabaseTableRoute() {
  const { instrumentName } = Route.useParams()
  const { schema, table } = Route.useSearch()

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
