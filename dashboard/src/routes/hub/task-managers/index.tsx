import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubTaskManagers() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Task managers" }]}
      phase="P3"
      description="Task manager fleet view — slot utilization, memory bars, status pills. Reads from useClusterStore.taskManagers."
    />
  )
}

export const Route = createFileRoute("/hub/task-managers/")({
  component: HubTaskManagers,
})
