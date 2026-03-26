import { createFileRoute } from "@tanstack/react-router"
import { CatalogBrowserPage } from "@/components/catalogs/catalog-browser-page"

/** Route: /catalogs/available — Catalog tree browser with database and table navigation. */
export const Route = createFileRoute("/catalogs/available")({
  component: CatalogBrowserPage,
})
