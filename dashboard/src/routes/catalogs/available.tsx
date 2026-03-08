import { createFileRoute } from "@tanstack/react-router"
import { CatalogBrowserPage } from "@/components/catalogs/catalog-browser-page"

export const Route = createFileRoute("/catalogs/available")({
  component: CatalogBrowserPage,
})
