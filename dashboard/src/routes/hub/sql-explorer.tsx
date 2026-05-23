/**
 * Hub SQL Explorer — /hub/sql-explorer.
 *
 * Full-bleed 2-column workspace (saved queries / editor + results).
 * Initial SQL can be passed via `?q=<base64>` for shareable links
 * from the editor's Share button.
 */

import { createFileRoute, useSearch } from "@tanstack/react-router"
import { SqlExplorer } from "@/components/hub/tools/sql-explorer/sql-explorer"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { PageFullBleed } from "@/lib/hub/page-full-bleed"

interface SqlExplorerSearch {
  q?: string
}

function HubSqlExplorerPage() {
  const { q } = useSearch({ from: "/hub/sql-explorer" })
  const initialSql = q ? safeB64Decode(q) : undefined
  return (
    <HubAppShell>
      <PageFullBleed>
        <SqlExplorer initialSql={initialSql} />
      </PageFullBleed>
    </HubAppShell>
  )
}

function safeB64Decode(encoded: string): string | undefined {
  try {
    return decodeURIComponent(escape(atob(encoded)))
  } catch {
    return undefined
  }
}

export const Route = createFileRoute("/hub/sql-explorer")({
  validateSearch: (search: Record<string, unknown>): SqlExplorerSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: HubSqlExplorerPage,
})
