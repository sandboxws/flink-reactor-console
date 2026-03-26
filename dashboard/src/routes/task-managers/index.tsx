import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { TaskManagerList } from "@/components/task-managers/task-manager-list"
import { useClusterStore } from "@/stores/cluster-store"

/** Route: /task-managers — Task manager list with resource utilization and polling. */
export const Route = createFileRoute("/task-managers/")({
  component: TaskManagers,
})

function TaskManagers() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const taskManagers = useClusterStore((s) => s.taskManagers)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Task Managers</h1>
        <span className="text-xs tabular-nums text-zinc-500">
          {taskManagers.length}{" "}
          {taskManagers.length === 1 ? "task manager" : "task managers"}
        </span>
      </div>
      <div className="glass-card overflow-hidden">
        <TaskManagerList taskManagers={taskManagers} />
      </div>
    </div>
  )
}
