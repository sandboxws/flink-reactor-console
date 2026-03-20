import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Grid3x3, List, Play, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SimulationPresetCard } from "@/components/admin/simulation-preset-card"
import { SimulationRunTimeline } from "@/components/admin/simulation-run-timeline"
import type { SimulationInputParams, SimulationPreset } from "@/lib/graphql-api-client"
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

const categoryColors: Record<string, string> = {
  resource: "bg-fr-purple/15 text-fr-purple",
  checkpoint: "bg-fr-amber/15 text-fr-amber",
  load: "bg-job-running/15 text-job-running",
  failure: "bg-job-failed/15 text-job-failed",
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

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
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Simulations</h1>
        <div className="flex items-center gap-0.5 rounded-md border border-dash-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded p-1 transition-colors",
              viewMode === "grid"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
            title="Grid view"
          >
            <Grid3x3 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded p-1 transition-colors",
              viewMode === "list"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
            title="List view"
          >
            <List className="size-3.5" />
          </button>
        </div>
      </div>

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

      {/* Presets — grid or list view */}
      {viewMode === "grid" ? (
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
      ) : (
        <PresetListView
          presets={presets}
          onRun={runSimulation}
          isRunning={isSimRunning}
        />
      )}

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

// ---------------------------------------------------------------------------
// List view for presets
// ---------------------------------------------------------------------------

function PresetListView({
  presets,
  onRun,
  isRunning,
}: {
  presets: SimulationPreset[]
  onRun: (input: SimulationInputParams) => Promise<void>
  isRunning: boolean
}) {
  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dash-border text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">Scenario</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <PresetListRow
              key={preset.scenario}
              preset={preset}
              onRun={onRun}
              isRunning={isRunning}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PresetListRow({
  preset,
  onRun,
  isRunning,
}: {
  preset: SimulationPreset
  onRun: (input: SimulationInputParams) => Promise<void>
  isRunning: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [params, setParams] = useState<Record<string, unknown>>(
    preset.defaultParameters,
  )

  const handleRun = async () => {
    setSubmitting(true)
    await onRun({ scenario: preset.scenario, parameters: params })
    setSubmitting(false)
    setExpanded(false)
  }

  return (
    <>
      <tr className="border-b border-dash-border/50 hover:bg-white/[0.02]">
        <td className="px-3 py-2 font-medium text-zinc-200">{preset.name}</td>
        <td className="px-3 py-2">
          <Badge
            variant="outline"
            className={cn(
              "border-0 text-[10px]",
              categoryColors[preset.category] ?? "bg-zinc-500/15 text-zinc-400",
            )}
          >
            {preset.category}
          </Badge>
        </td>
        <td className="px-3 py-2 text-zinc-500 max-w-md truncate">
          {preset.description}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 text-[10px] text-zinc-500"
            >
              {expanded ? "Collapse" : "Configure"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isRunning || submitting}
              onClick={handleRun}
              className="h-6 text-[10px]"
            >
              <Play className="mr-1 size-2.5" />
              {submitting ? "Starting..." : "Run"}
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-dash-border/50 bg-white/[0.01]">
          <td colSpan={4} className="px-3 py-2">
            <div className="flex flex-wrap gap-3">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <label className="text-[10px] font-medium text-zinc-500">
                    {key}
                  </label>
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        [key]: Number.isNaN(Number(e.target.value))
                          ? e.target.value
                          : Number(e.target.value),
                      }))
                    }
                    className="w-24 rounded bg-dash-surface px-1.5 py-0.5 text-[10px] text-zinc-200 border border-dash-border focus:border-fr-purple/50 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
