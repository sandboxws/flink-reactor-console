import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { JobsTable } from "@/components/jobs/jobs-table"
import { useClusterStore } from "@/stores/cluster-store"

export const Route = createFileRoute("/jobs/completed")({
  component: CompletedJobs,
})

function CompletedJobs() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const completedJobs = useClusterStore((s) => s.completedJobs)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Completed Jobs</h1>
        <span className="text-xs tabular-nums text-zinc-500">
          {completedJobs.length} {completedJobs.length === 1 ? "job" : "jobs"}
        </span>
      </div>
      <div className="glass-card overflow-hidden">
        <JobsTable mode="completed" jobs={completedJobs} />
      </div>
    </div>
  )
}
