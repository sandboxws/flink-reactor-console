import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { SubmitJobPage } from "@/components/jobs/submit-job-page"
import { useClusterStore } from "@/stores/cluster-store"

/** Route: /jobs/submit — Job submission form for uploading and configuring new Flink jobs. */
export const Route = createFileRoute("/jobs/submit")({
  component: SubmitJob,
})

function SubmitJob() {
  const initialize = useClusterStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <SubmitJobPage />
}
