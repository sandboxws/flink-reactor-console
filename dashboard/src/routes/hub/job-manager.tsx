import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubJobManager() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Job manager" }]}
      phase="P3"
      description="Job manager detail — JVM metrics, config, logs, stdout, classpath, threads, profiler."
    />
  )
}

export const Route = createFileRoute("/hub/job-manager")({
  component: HubJobManager,
})
