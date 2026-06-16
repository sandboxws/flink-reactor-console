/**
 * Hub materialized-tables explore — /hub/materialized-tables/explore.
 *
 * Built-in queries for the materialized-table lifecycle (create streaming &
 * batch, inspect, manage), reusing the shared SQL Explorer console with a
 * materialized-table-specific template set. Reached via the "Examples" button
 * on the materialized-tables list. The static `explore` segment resolves ahead
 * of the sibling dynamic `$name` route, so there is no collision.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { MATERIALIZED_EXPLORE_TEMPLATES } from "@/components/hub/data/materialized-explore-templates"
import { SqlExplorer } from "@/components/hub/tools/sql-explorer/sql-explorer"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { PageFullBleed } from "@/lib/hub/page-full-bleed"

function HubMaterializedExplore() {
  return (
    <HubAppShell>
      <PageFullBleed>
        <div className="shrink-0 px-8 pt-4 pb-2">
          <HubBreadcrumb
            crumbs={[
              { label: "Data" },
              { label: "Materialized tables" },
              { label: "Examples" },
            ]}
            LinkComponent={HubLink}
          />
          <p className="mt-1 font-mono text-[11px] text-fg-muted">
            Runnable built-in queries on the Paimon catalog — open{" "}
            <span className="text-fg">Templates</span> to create a continuous
            materialized table, inspect it, and drop it. (FULL refresh and
            SUSPEND/RESUME/REFRESH need a Flink workflow scheduler.)
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <SqlExplorer templates={MATERIALIZED_EXPLORE_TEMPLATES} />
        </div>
      </PageFullBleed>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/materialized-tables/explore")({
  component: HubMaterializedExplore,
})
