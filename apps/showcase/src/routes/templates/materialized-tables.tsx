import { MatTablesSectionDemo } from "@flink-reactor/ui/src/templates/materialized-tables/mat-tables-section.demo"
import { createFileRoute } from "@tanstack/react-router"

function MaterializedTablesTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">
          Materialized Tables Template
        </h1>
        <p className="mt-1 text-fg-muted">
          Materialized table management with refresh status
        </p>
      </div>
      <MatTablesSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/materialized-tables")({
  component: MaterializedTablesTemplatePage,
})
