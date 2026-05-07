/**
 * Hub benchmarks — /hub/admin/benchmarks.
 *
 * Re-tokened version of the legacy benchmarks page. Same select-then-compare
 * UX (checkbox per row, "Compare N runs" button, side-by-side metric table)
 * but rendered with Hub surfaces (`glass-card-static`, `state-pill`,
 * `sev-badge`) instead of the legacy badges + glass-card.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { format, formatDistanceToNow } from "date-fns"
import { ArrowRight, BarChart3, FlaskConical, X } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import {
  fetchSimulationRun,
  type SimulationObservation,
  type SimulationRun,
  type SimulationStatus,
} from "@/lib/graphql-api-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useSimulationStore } from "@/stores/simulation-store"

const COMPARISON_METRICS = [
  "throughput",
  "checkpoint_duration",
  "checkpoint_size",
  "backpressure_pct",
  "restart_count",
  "watermark_lag",
]

function statusPillModifier(status: SimulationStatus): string {
  switch (status) {
    case "COMPLETED":
      return "done"
    case "FAILED":
    case "CANCELLED":
      return "failed"
    case "RUNNING":
      return "active"
    default:
      return "pending"
  }
}

function HubBenchmarks() {
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
      if (next.has(id)) next.delete(id)
      else if (next.size < 5) next.add(id)
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

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Tools" }, { label: "Benchmarks" }]}
        LinkComponent={HubLink}
      />
      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Benchmarks
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Compare completed simulation runs side-by-side. Select 2–5 runs and
          inspect throughput, checkpoint, and backpressure deltas.
        </p>
      </div>

      {isLoading && runs.length === 0 ? (
        <p className="text-[12px] font-mono text-fg-faint">Loading…</p>
      ) : completedRuns.length === 0 ? (
        <div className="glass-card-static flex max-w-md flex-col items-center gap-4 px-10 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-fr-purple/10">
            <FlaskConical className="size-6 text-fr-purple" />
          </div>
          <div>
            <h3 className="font-sans text-[14px] font-medium text-zinc-100">
              No benchmark data yet
            </h3>
            <p className="mt-1 text-[12px] text-fg-muted">
              Run simulation scenarios first to collect benchmark observations.
            </p>
          </div>
          <Link
            to="/hub/admin/simulations"
            className="btn btn-secondary btn-sm"
          >
            Go to simulations
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {comparisonRuns.length >= 2 ? (
            <ComparisonReport runs={comparisonRuns} onClear={clearComparison} />
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-heading">Simulation runs</h2>
              {selectedIds.size >= 2 && comparisonRuns.length === 0 ? (
                <button
                  type="button"
                  onClick={loadComparison}
                  disabled={loadingComparison}
                  className="btn btn-secondary btn-sm"
                >
                  <BarChart3 className="size-3" />
                  {loadingComparison
                    ? "Loading…"
                    : `Compare ${selectedIds.size} runs`}
                </button>
              ) : null}
            </div>
            <p className="mb-2 text-[11px] text-fg-muted">
              Click <strong className="text-fg">View</strong> to open a run, or
              check 2–5 rows and click{" "}
              <strong className="text-fg">Compare</strong>.
            </p>
            <div className="glass-card-static overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dash-border text-left text-fg-faint">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Scenario
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider">
                      Observations
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border/40">
                  {completedRuns.map((run) => (
                    <tr
                      key={run.id}
                      className={cn(
                        selectedIds.has(run.id)
                          ? "bg-fr-coral/5"
                          : "hover:bg-dash-elevated/30",
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(run.id)}
                          onChange={() => toggleSelection(run.id)}
                          className="cursor-pointer rounded border-dash-border"
                          aria-label={`Select ${run.scenario}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-fg">
                        {run.scenario}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`state-pill ${statusPillModifier(run.status)}`}
                        >
                          {run.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-fg-faint">
                        {formatDistanceToNow(new Date(run.startedAt), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-fg-muted">
                        {run.observations?.length ?? 0}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to="/hub/admin/simulations/$runId"
                          params={{ runId: run.id }}
                          className="inline-flex items-center gap-1 text-[11px] text-fr-coral hover:underline"
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
          </section>
        </div>
      )}
    </HubAppShell>
  )
}

function summarizeMetrics(observations: SimulationObservation[]) {
  const byMetric = new Map<string, number[]>()
  for (const obs of observations) {
    if (!byMetric.has(obs.metric)) byMetric.set(obs.metric, [])
    byMetric.get(obs.metric)?.push(obs.value)
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

  const allMetrics = new Set<string>()
  for (const s of summaries) {
    for (const key of Object.keys(s.metrics)) {
      if (key !== "status" && key !== "elapsed_sec") allMetrics.add(key)
    }
  }
  const orderedMetrics = [
    ...COMPARISON_METRICS.filter((m) => allMetrics.has(m)),
    ...Array.from(allMetrics).filter((m) => !COMPARISON_METRICS.includes(m)),
  ]

  return (
    <div className="glass-card-static p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-sans text-[14px] font-medium text-zinc-100">
          Comparison — {runs.length} runs
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-fg-faint hover:text-fg"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
        {summaries.map(({ run }) => (
          <div
            key={run.id}
            className="min-w-[180px] shrink-0 rounded-md border border-dash-border bg-dash-surface px-3 py-2"
          >
            <div className="truncate text-[11.5px] font-medium text-fg">
              {run.scenario}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-fg-faint">
              {format(new Date(run.startedAt), "MMM d, HH:mm")}
              {run.stoppedAt ? (
                <>
                  {" · "}
                  {Math.round(
                    (new Date(run.stoppedAt).getTime() -
                      new Date(run.startedAt).getTime()) /
                      1000,
                  )}
                  s
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {orderedMetrics.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-fg-muted">
          No comparable metrics yet. Run scenarios with target jobs to collect
          throughput, checkpoint, and backpressure observations.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-dash-border text-left text-fg-faint">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                  Metric
                </th>
                {summaries.map(({ run }) => (
                  <th
                    key={run.id}
                    className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider"
                  >
                    {run.scenario.split(".").pop()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border/40">
              {orderedMetrics.map((metric) => (
                <tr key={metric}>
                  <td className="px-3 py-2 font-mono text-fg-muted">
                    {metric}
                  </td>
                  {summaries.map(({ run, metrics }) => {
                    const data = metrics[metric]
                    return (
                      <td
                        key={run.id}
                        className="px-3 py-2 text-right font-mono text-fg"
                      >
                        {data ? (
                          <div>
                            <div>{data.avg.toFixed(1)}</div>
                            <div className="text-[9.5px] text-fg-faint">
                              {data.min.toFixed(0)}–{data.max.toFixed(0)} (
                              {data.count} pts)
                            </div>
                          </div>
                        ) : (
                          <span className="text-fg-faint">—</span>
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

export const Route = createFileRoute("/hub/admin/benchmarks/")({
  component: HubBenchmarks,
})
