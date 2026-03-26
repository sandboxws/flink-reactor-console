import { CatalogBrowserSectionDemo } from "@flink-reactor/ui/src/templates/catalogs/catalog-browser-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/catalogs -- Demonstrates the catalog browser template section with schema and column details. */
function CatalogsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Catalogs Template</h1>
        <p className="mt-1 text-fg-muted">
          Catalog browser with schema and column details
        </p>
      </div>
      <CatalogBrowserSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/catalogs")({
  component: CatalogsTemplatePage,
})
