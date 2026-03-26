import { ErrorExplorerSectionDemo } from "@flink-reactor/ui/src/templates/errors/error-explorer-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/errors -- Demonstrates the error explorer template section with grouping and timeline. */
function ErrorsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Errors Template</h1>
        <p className="mt-1 text-fg-muted">
          Error explorer with grouping and timeline
        </p>
      </div>
      <ErrorExplorerSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/errors")({
  component: ErrorsTemplatePage,
})
