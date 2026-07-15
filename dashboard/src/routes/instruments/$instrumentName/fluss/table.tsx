import { createFileRoute } from "@tanstack/react-router"
import { FlussTableDetail } from "@/components/instruments/fluss/fluss-table-detail"

type TableSearch = {
  database: string
  table: string
}

/** Route: /instruments/$instrumentName/fluss/table — Fluss table detail via search params. */
export const Route = createFileRoute(
  "/instruments/$instrumentName/fluss/table",
)({
  validateSearch: (search: Record<string, unknown>): TableSearch => ({
    database: (search.database as string) ?? "",
    table: (search.table as string) ?? "",
  }),
  component: () => {
    const { instrumentName } = Route.useParams()
    const { database, table } = Route.useSearch()
    return (
      <FlussTableDetail
        instrumentName={instrumentName}
        database={database}
        table={table}
      />
    )
  },
})
