/**
 * Hub submit pipeline — /hub/jobs/submit.
 *
 * Wraps the `<SubmitJarForm>` in a Hub shell. On successful submission the
 * page navigates to the new pipeline's detail route. Note: `runJar` returns
 * void in the current API; we navigate to /hub/jobs/running rather than
 * directly to the new job, since the new job ID isn't surfaced.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SubmitJarForm } from "@/components/hub/jobs/submit-jar-form"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubJobsSubmit() {
  const navigate = useNavigate()
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Pipelines", to: "/hub/jobs/running" },
          { label: "Submit" },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Submit pipeline
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Upload a JAR and configure entry class, parallelism, args, and an
          optional savepoint.
        </p>
      </div>

      <div className="max-w-3xl">
        <SubmitJarForm
          onSubmitted={() => navigate({ to: "/hub/jobs/running" })}
        />
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/jobs/submit")({
  component: HubJobsSubmit,
})
