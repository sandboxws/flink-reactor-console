import { QueryEditor } from "../components/database/query-editor"

export function DatabaseQueryRoute({
  instrumentName,
}: {
  instrumentName: string
}) {
  return <QueryEditor instrumentName={instrumentName} />
}
