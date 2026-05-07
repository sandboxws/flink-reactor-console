import { createFileRoute, useParams } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubTaskManagerDetail() {
  const { id } = useParams({ from: "/hub/task-managers/$id" })
  return (
    <HubComingSoon
      crumbs={[
        { label: "Task managers", to: "/hub/task-managers" },
        { label: id, mono: true },
      ]}
      title={`Task manager ${id}`}
      phase="P3"
      description="Task manager detail — JVM metrics, logs, stdout, thread dump, classpath."
    />
  )
}

export const Route = createFileRoute("/hub/task-managers/$id")({
  component: HubTaskManagerDetail,
})
