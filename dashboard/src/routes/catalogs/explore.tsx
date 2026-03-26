import { createFileRoute } from "@tanstack/react-router"
import { CatalogExplorePage } from "@/components/catalogs/catalog-explore-page"

/** Route: /catalogs/explore — SQL explore editor with catalog-aware autocompletion. */
export const Route = createFileRoute("/catalogs/explore")({
  component: CatalogExplorePage,
})
