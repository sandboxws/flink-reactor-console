/**
 * Hub Schema Registry index — /hub/instruments/$instrumentName/schema-registry.
 *
 * Renders the subjects list. Subject detail (with diff viewer) and
 * compatibility check are reachable via the tabs row.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { SchemaSubjectList } from "@/components/hub/instruments/schema-subject-list"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubSchemaRegistryIndex() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/schema-registry/",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Schema registry" },
        ]}
        LinkComponent={HubLink}
      />
      <SchemaRegistrySubTabs instrument={instrumentName} active="overview" />
      <div className="mt-5">
        <SchemaSubjectList instrument={instrumentName} />
      </div>
    </HubAppShell>
  )
}

interface SchemaSubTabsProps {
  instrument: string
  active: "overview" | "subject" | "compatibility"
}

export function SchemaRegistrySubTabs({
  instrument,
  active,
}: SchemaSubTabsProps) {
  return (
    <div className="mt-3 flex items-center gap-1 border-b border-dash-border">
      <Link
        to="/hub/instruments/$instrumentName/schema-registry"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "overview" ? "active" : ""}`}
      >
        Subjects
      </Link>
      <Link
        to="/hub/instruments/$instrumentName/schema-registry/compatibility"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "compatibility" ? "active" : ""}`}
      >
        Compatibility
      </Link>
      {active === "subject" ? (
        <span className="tab active">Subject</span>
      ) : null}
    </div>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/schema-registry/",
)({
  component: HubSchemaRegistryIndex,
})
