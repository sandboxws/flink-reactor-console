import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubSqlExplorer() {
  return (
    <HubComingSoon
      crumbs={[{ label: "SQL explorer" }]}
      phase="P4"
      description="3-column workspace — saved queries (left), CodeMirror SQL editor (center), schema navigator (right). Run via the existing SQL Gateway store; results table below."
    />
  )
}

export const Route = createFileRoute("/hub/sql-explorer")({
  component: HubSqlExplorer,
})
