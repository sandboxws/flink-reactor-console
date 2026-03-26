import { TmListSectionDemo } from "@flink-reactor/ui/src/templates/task-managers/tm-list-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/task-managers -- Demonstrates the task manager list template section with metrics overview. */
function TaskManagersTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">
          Task Managers Template
        </h1>
        <p className="mt-1 text-fg-muted">
          Task manager list with metrics overview
        </p>
      </div>
      <TmListSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/task-managers")({
  component: TaskManagersTemplatePage,
})
