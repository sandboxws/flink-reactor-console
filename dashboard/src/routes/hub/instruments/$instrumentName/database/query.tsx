/**
 * Hub database query editor — /hub/instruments/$instrumentName/database/query.
 *
 * Renders the read-only `<DatabaseQueryEditor>` for ad-hoc SQL against
 * the selected database instrument. Initial SQL can be passed via
 * `?sql=...`.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { DatabaseQueryEditor } from "@/components/hub/instruments/database-query-editor"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { DatabaseSubTabs } from "./index"

interface QuerySearch {
  sql?: string
}

function HubDatabaseQuery() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/database/query",
  })
  const { sql } = useSearch({
    from: "/hub/instruments/$instrumentName/database/query",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Database",
            to: "/hub/instruments/$instrumentName/database".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: "Query" },
        ]}
        LinkComponent={HubLink}
      />
      <DatabaseSubTabs instrument={instrumentName} active="query" />
      <div className="mt-5">
        <DatabaseQueryEditor instrument={instrumentName} initialSql={sql} />
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/database/query",
)({
  validateSearch: (search: Record<string, unknown>): QuerySearch => ({
    sql: typeof search.sql === "string" ? search.sql : undefined,
  }),
  component: HubDatabaseQuery,
})
