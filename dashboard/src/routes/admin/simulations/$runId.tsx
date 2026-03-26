import { Skeleton } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useEffect } from "react"
import { SimulationRunTimeline } from "@/components/admin/simulation-run-timeline"
import { useSimulationStore } from "@/stores/simulation-store"

/** Route: /admin/simulations/$runId — Simulation run detail with timeline, live polling for active runs, and back-navigation. */
export const Route = createFileRoute("/admin/simulations/$runId")({
  component: SimulationRunPage,
})

function SimulationRunPage() {
  const { runId } = Route.useParams()
  const fetchRun = useSimulationStore((s) => s.fetchRun)
  const activeRun = useSimulationStore((s) => s.activeRun)
  const startActivePolling = useSimulationStore((s) => s.startActivePolling)
  const stopActivePolling = useSimulationStore((s) => s.stopActivePolling)
  const clearActiveRun = useSimulationStore((s) => s.clearActiveRun)

  useEffect(() => {
    fetchRun(runId)
    return () => clearActiveRun()
  }, [runId, fetchRun, clearActiveRun])

  // Start polling if the run is still active.
  useEffect(() => {
    if (
      activeRun &&
      (activeRun.status === "RUNNING" || activeRun.status === "PENDING")
    ) {
      startActivePolling(runId)
    }
    return () => stopActivePolling()
  }, [activeRun?.status, runId, startActivePolling, stopActivePolling])

  if (!activeRun) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link
        to="/admin/simulations"
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Simulations
      </Link>

      <div className="glass-card p-4">
        <SimulationRunTimeline run={activeRun} />
      </div>
    </div>
  )
}
