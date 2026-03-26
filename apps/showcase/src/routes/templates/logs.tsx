import { LogExplorerSectionDemo } from "@flink-reactor/ui/src/templates/logs/log-explorer-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/logs -- Demonstrates the log explorer template section with filtering and search. */
function LogsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Logs Template</h1>
        <p className="mt-1 text-fg-muted">
          Log explorer with filtering and search
        </p>
      </div>
      <LogExplorerSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/logs")({
  component: LogsTemplatePage,
})
