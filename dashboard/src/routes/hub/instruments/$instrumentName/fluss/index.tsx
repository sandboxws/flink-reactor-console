/**
 * Hub Fluss instrument index — /hub/instruments/$instrumentName/fluss.
 *
 * Renders the database/table browser. Health is reachable via the
 * sub-tabs row at the top.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { FlussTableBrowser } from "@/components/hub/instruments/fluss-table-browser"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubFlussIndex() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/fluss/",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Fluss" },
        ]}
        LinkComponent={HubLink}
      />
      <FlussSubTabs instrument={instrumentName} active="overview" />
      <div className="mt-5">
        <FlussTableBrowser instrument={instrumentName} />
      </div>
    </HubAppShell>
  )
}

interface FlussSubTabsProps {
  instrument: string
  active: "overview" | "table" | "health"
}

export function FlussSubTabs({ instrument, active }: FlussSubTabsProps) {
  return (
    <div className="mt-3 flex items-center gap-1 border-b border-dash-border">
      <Link
        to="/hub/instruments/$instrumentName/fluss"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "overview" ? "active" : ""}`}
      >
        Overview
      </Link>
      <Link
        to="/hub/instruments/$instrumentName/fluss/health"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "health" ? "active" : ""}`}
      >
        Health
      </Link>
      {active === "table" ? <span className="tab active">Table</span> : null}
    </div>
  )
}

export const Route = createFileRoute("/hub/instruments/$instrumentName/fluss/")(
  {
    component: HubFlussIndex,
  },
)
