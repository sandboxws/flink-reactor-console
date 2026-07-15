import { FlussTableDetail } from "../components/fluss/fluss-table-detail"

export function FlussTableRoute({
  instrumentName,
  database,
  table,
}: {
  instrumentName: string
  database: string
  table: string
}) {
  return (
    <FlussTableDetail
      instrumentName={instrumentName}
      database={database}
      table={table}
    />
  )
}
