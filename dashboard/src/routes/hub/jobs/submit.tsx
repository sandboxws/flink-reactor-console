import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubJobsSubmit() {
  return (
    <HubComingSoon
      crumbs={[
        { label: "Pipelines", to: "/hub/jobs/running" },
        { label: "Submit" },
      ]}
      title="Submit pipeline"
      phase="P3"
      description="JAR upload + parametrized submission form with savepoint restore options. Will reuse the existing /jobs/submit form components, restyled with Hub primitives."
      relatedTo={{ label: "View running pipelines", to: "/hub/jobs/running" }}
    />
  )
}

export const Route = createFileRoute("/hub/jobs/submit")({
  component: HubJobsSubmit,
})
