import { Badge, Button } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { format, formatDistanceToNow } from "date-fns"
import { ArrowRight, BarChart3, FlaskConical, X } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import type {
  SimulationObservation,
  SimulationRun,
} from "@/lib/graphql-api-client"
import { fetchSimulationRun } from "@/lib/graphql-api-client"
import { useSimulationStore } from "@/stores/simulation-store"

/** Route: /admin/benchmarks — Benchmark runner with run selection, side-by-side comparison, and metrics summary. */
export const Route = createFileRoute("/admin/benchmarks/")({
  component: BenchmarksPage,
})

const statusColors: Record<string, string> = {
  COMPLETED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELLED: "bg-job-cancelled/15 text-job-cancelled",
}

// Metrics to show in the comparison table (filter out internal metrics)
const COMPARISON_METRICS = [
  "throughput",
  "checkpoint_duration",
  "checkpoint_size",
  "backpressure_pct",
  "restart_count",
  "watermark_lag",
]

function BenchmarksPage() {
  const initialize = useSimulationStore((s) => s.initialize)
  const runs = useSimulationStore((s) => s.runs)
  const isLoading = useSimulationStore((s) => s.isLoading)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [comparisonRuns, setComparisonRuns] = useState<SimulationRun[]>([])
  const [loadingComparison, setLoadingComparison] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  const completedRuns = runs.filter(
    (r) =>
      r.status === "COMPLETED" ||
      r.status === "FAILED" ||
      r.status === "CANCELLED",
  )

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      }
      return next
    })
  }

  const loadComparison = async () => {
    setLoadingComparison(true)
    const loaded: SimulationRun[] = []
    for (const id of selectedIds) {
      const run = await fetchSimulationRun(id)
      if (run) loaded.push(run)
    }
    setComparisonRuns(loaded)
    setLoadingComparison(false)
  }

  const clearComparison = () => {
    setComparisonRuns([])
    setSelectedIds(new Set())
  }

  if (isLoading && runs.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-500">Loading benchmarks...</div>
    )
  }

  if (completedRuns.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="glass-card flex max-w-md flex-col items-center gap-5 px-10 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-fr-purple/10">
            <FlaskConical className="size-7 text-fr-purple" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-medium text-zinc-200">
              No benchmark data yet
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Run simulation scenarios first to collect benchmark observations.
            </p>
          </div>
          <Link to="/admin/simulations">
            <Button variant="outline" size="sm">
              Go to Simulations
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">Benchmarks</h1>

      {/* Comparison report */}
      {comparisonRuns.length >= 2 && (
        <ComparisonReport runs={comparisonRuns} onClear={clearComparison} />
      )}

      {/* Run selector */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Simulation Runs
          </p>
          {selectedIds.size >= 2 && comparisonRuns.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadComparison}
              disabled={loadingComparison}
            >
              <BarChart3 className="mr-1.5 size-3" />
              {loadingComparison
                ? "Loading..."
                : `Compare ${selectedIds.size} Runs`}
            </Button>
          )}
        </div>
        <p className="mb-2 text-[10px] text-zinc-500">
          Click <strong>View</strong> to see a run's full report, or check
          multiple runs and click <strong>Compare</strong> for side-by-side
          analysis.
        </p>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border text-left text-zinc-500">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium text-right">
                  Observations
                </th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedRuns.map((run) => (
                <tr
                  key={run.id}
                  className={cn(
                    "border-b border-dash-border/50",
                    selectedIds.has(run.id)
                      ? "bg-fr-purple/5"
                      : "hover:bg-white/[0.02]",
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(run.id)}
                      onChange={() => toggleSelection(run.id)}
                      className="rounded border-dash-border cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-zinc-200">{run.scenario}</td>
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
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/simulations/$runId"
                      params={{ runId: run.id }}
                      className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      View
                      <ArrowRight className="size-2.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparison Report
// ---------------------------------------------------------------------------

function summarizeMetrics(observations: SimulationObservation[]) {
  const byMetric = new Map<string, number[]>()
  for (const obs of observations) {
    if (!byMetric.has(obs.metric)) byMetric.set(obs.metric, [])
    byMetric.get(obs.metric)!.push(obs.value)
  }
  const summary: Record<
    string,
    { avg: number; min: number; max: number; count: number }
  > = {}
  for (const [metric, values] of byMetric) {
    summary[metric] = {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    }
  }
  return summary
}

function ComparisonReport({
  runs,
  onClear,
}: {
  runs: SimulationRun[]
  onClear: () => void
}) {
  const summaries = runs.map((run) => ({
    run,
    metrics: summarizeMetrics(run.observations ?? []),
  }))

  // Collect all unique metrics across runs (excluding internal ones)
  const allMetrics = new Set<string>()
  for (const s of summaries) {
    for (const key of Object.keys(s.metrics)) {
      if (key !== "status" && key !== "elapsed_sec") allMetrics.add(key)
    }
  }
  // Show known comparison metrics first, then any extras
  const orderedMetrics = [
    ...COMPARISON_METRICS.filter((m) => allMetrics.has(m)),
    ...Array.from(allMetrics).filter((m) => !COMPARISON_METRICS.includes(m)),
  ]

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-200">
          Comparison — {runs.length} runs
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      {/* Run summary row */}
      <div className="mb-4 flex gap-3 overflow-x-auto">
        {summaries.map(({ run }) => (
          <div
            key={run.id}
            className="shrink-0 rounded-md bg-dash-surface px-3 py-2 min-w-[160px]"
          >
            <div className="text-[10px] font-medium text-zinc-200 truncate">
              {run.scenario}
            </div>
            <div className="text-[9px] text-zinc-500">
              {format(new Date(run.startedAt), "MMM d, HH:mm")}
              {run.stoppedAt && (
                <span>
                  {" "}
                  —{" "}
                  {Math.round(
                    (new Date(run.stoppedAt).getTime() -
                      new Date(run.startedAt).getTime()) /
                      1000,
                  )}
                  s
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Metric comparison table */}
      {orderedMetrics.length === 0 ? (
        <div className="text-xs text-zinc-500 text-center py-4">
          No comparable metrics found. Run scenarios with target jobs to collect
          throughput, checkpoint, and backpressure observations.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border text-left text-zinc-500">
                <th className="px-3 py-2 font-medium">Metric</th>
                {summaries.map(({ run }) => (
                  <th key={run.id} className="px-3 py-2 font-medium text-right">
                    {run.scenario.split(".").pop()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderedMetrics.map((metric) => (
                <tr
                  key={metric}
                  className="border-b border-dash-border/50 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 text-zinc-400">{metric}</td>
                  {summaries.map(({ run, metrics }) => {
                    const data = metrics[metric]
                    return (
                      <td
                        key={run.id}
                        className="px-3 py-2 text-right font-mono text-zinc-200"
                      >
                        {data ? (
                          <div>
                            <div>{data.avg.toFixed(1)}</div>
                            <div className="text-[9px] text-zinc-600">
                              {data.min.toFixed(0)}–{data.max.toFixed(0)} (
                              {data.count} pts)
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
