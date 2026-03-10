import { createFileRoute } from "@tanstack/react-router"
import { DatabaseTableRoute } from "@flink-reactor/instruments-ui"

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
  component: () => {
    const { instrumentName } = Route.useParams()
    const { schema, table } = Route.useSearch()
    return (
      <DatabaseTableRoute
        instrumentName={instrumentName}
        schema={schema}
        table={table}
      />
    )
  },
})
