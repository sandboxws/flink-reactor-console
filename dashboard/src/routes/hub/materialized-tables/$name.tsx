import { createFileRoute, useParams } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubMaterializedTableDetail() {
  const { name } = useParams({ from: "/hub/materialized-tables/$name" })
  return (
    <HubComingSoon
      crumbs={[
        { label: "Materialized tables", to: "/hub/materialized-tables" },
        { label: name, mono: true },
      ]}
      title={name}
      phase="P3"
      description="Materialized table detail — column schema, refresh history, sample rows."
    />
  )
}

export const Route = createFileRoute("/hub/materialized-tables/$name")({
  component: HubMaterializedTableDetail,
})
