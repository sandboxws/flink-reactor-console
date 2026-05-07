import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubMaterializedTables() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Materialized tables" }]}
      phase="P3"
      description="Materialized tables list — schema, refresh status, last update timestamp. Reads from useMaterializedTableStore."
    />
  )
}

export const Route = createFileRoute("/hub/materialized-tables/")({
  component: HubMaterializedTables,
})
