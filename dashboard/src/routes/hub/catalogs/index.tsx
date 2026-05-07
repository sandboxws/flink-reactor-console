import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubCatalogs() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Catalogs" }]}
      phase="P3"
      description="3-pane catalog browser — file-tree (left), table detail (center), columns + sample (right). Reads from useCatalogStore + useCatalogExploreStore."
    />
  )
}

export const Route = createFileRoute("/hub/catalogs/")({
  component: HubCatalogs,
})
