import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubJobsCompleted() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Pipelines", to: "/hub/jobs/running" },
        { label: "Completed" },
      ]}
      title="Completed pipelines"
      phase="P3"
      description="Table of finished, failed, and cancelled jobs with filtering, time-range scoping, and per-job exit summary. Will read from useClusterStore.completedJobs."
      relatedTo={{ label: "View running pipelines", to: "/hub/jobs/running" }}
    />
  )
}

export const Route = createFileRoute("/hub/jobs/completed")({
  component: HubJobsCompleted,
})
