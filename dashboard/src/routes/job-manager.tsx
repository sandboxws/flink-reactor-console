import { createFileRoute } from "@tanstack/react-router"
import { AlertCircle } from "lucide-react"
import { useEffect } from "react"
import { JobManagerPage } from "@/components/job-manager/job-manager-page"
import { EmptyState } from "@flink-reactor/ui"
import { useClusterStore } from "@/stores/cluster-store"

export const Route = createFileRoute("/job-manager")({
  component: JobManager,
})

function JobManager() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const jobManager = useClusterStore((s) => s.jobManager)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  if (!jobManager) {
    return (
      <EmptyState icon={AlertCircle} message="Job Manager data not available" />
    )
  }

  return <JobManagerPage jm={jobManager} />
}
