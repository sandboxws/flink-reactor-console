import { DatabaseTableRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute } from "@tanstack/react-router"

type TableSearch = {
  schema: string
  table: string
}

/** Route: /instruments/$instrumentName/database/table — Table detail with schema and data preview via search params. */
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
