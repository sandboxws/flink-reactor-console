import { createFileRoute } from "@tanstack/react-router"
import { CatalogExplorePage } from "@/components/catalogs/catalog-explore-page"

export const Route = createFileRoute("/catalogs/explore")({
  component: CatalogExplorePage,
})
