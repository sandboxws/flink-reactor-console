import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SimulationPresetCard } from "@/components/admin/simulation-preset-card"
import { SimulationRunTimeline } from "@/components/admin/simulation-run-timeline"
import { cn } from "@/lib/cn"
import { useSimulationStore } from "@/stores/simulation-store"

export const Route = createFileRoute("/admin/simulations/")({
  component: SimulationsPage,
})

const statusColors: Record<string, string> = {
  PENDING: "bg-zinc-500/15 text-zinc-400",
  RUNNING: "bg-job-running/15 text-job-running",
  COMPLETED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELLED: "bg-job-cancelled/15 text-job-cancelled",
}

function SimulationsPage() {
  const initialize = useSimulationStore((s) => s.initialize)
  const presets = useSimulationStore((s) => s.presets)
  const runs = useSimulationStore((s) => s.runs)
  const activeRun = useSimulationStore((s) => s.activeRun)
  const isLoading = useSimulationStore((s) => s.isLoading)
  const runSimulation = useSimulationStore((s) => s.runSimulation)
  const stopSimulation = useSimulationStore((s) => s.stopSimulation)
  const stopActivePolling = useSimulationStore((s) => s.stopActivePolling)

  useEffect(() => {
    initialize()
    return () => stopActivePolling()
  }, [initialize, stopActivePolling])

  const isSimRunning =
    activeRun?.status === "RUNNING" || activeRun?.status === "PENDING"

  if (isLoading && presets.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-500">Loading simulations...</div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">Simulations</h1>

      {/* Active simulation panel */}
      {activeRun && isSimRunning && (
        <div className="glass-card flex flex-col gap-3 border-job-running/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-job-running" />
              <span className="text-sm font-medium text-zinc-200">
                Running: {activeRun.scenario}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopSimulation(activeRun.id)}
            >
              <Square className="mr-1 size-3" />
              Stop
            </Button>
          </div>
          <SimulationRunTimeline run={activeRun} />
        </div>
      )}

      {/* Preset grid — flat layout, category shown on each card badge */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {presets.map((preset) => (
          <SimulationPresetCard
            key={preset.scenario}
            preset={preset}
            onRun={runSimulation}
            isRunning={isSimRunning}
          />
        ))}
      </div>

      {/* History table */}
      {runs.length > 0 && (
        <div>
          <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            History
          </h2>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Scenario</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Observations
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-dash-border/50 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to="/admin/simulations/$runId"
                        params={{ runId: run.id }}
                        className="text-zinc-200 hover:text-white"
                      >
                        {run.scenario}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-0 text-[10px]",
                          statusColors[run.status],
                        )}
                      >
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {formatDistanceToNow(new Date(run.startedAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500">
                      {run.observations?.length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
