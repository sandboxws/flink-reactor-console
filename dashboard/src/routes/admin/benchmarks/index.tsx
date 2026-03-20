import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SimulationRun } from "@/lib/graphql-api-client"
import { cn } from "@/lib/cn"
import { useSimulationStore } from "@/stores/simulation-store"

export const Route = createFileRoute("/admin/benchmarks/")({
  component: BenchmarksPage,
})

const statusColors: Record<string, string> = {
  COMPLETED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELLED: "bg-job-cancelled/15 text-job-cancelled",
}

function BenchmarksPage() {
  const initialize = useSimulationStore((s) => s.initialize)
  const runs = useSimulationStore((s) => s.runs)
  const isLoading = useSimulationStore((s) => s.isLoading)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  const selectedRuns = completedRuns.filter((r) => selectedIds.has(r.id))

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
      <p className="text-xs text-zinc-500">
        Select up to 5 completed simulation runs to compare their metrics.
      </p>

      {/* Comparison summary */}
      {selectedRuns.length >= 2 && (
        <div className="glass-card p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-200">
            Comparing {selectedRuns.length} runs
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedRuns.map((run) => (
              <ComparisonCard key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}

      {/* Run selector table */}
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
            </tr>
          </thead>
          <tbody>
            {completedRuns.map((run) => (
              <tr
                key={run.id}
                className={cn(
                  "border-b border-dash-border/50 cursor-pointer",
                  selectedIds.has(run.id)
                    ? "bg-fr-purple/5"
                    : "hover:bg-white/[0.02]",
                )}
                onClick={() => toggleSelection(run.id)}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(run.id)}
                    onChange={() => toggleSelection(run.id)}
                    className="rounded border-dash-border"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ComparisonCard({ run }: { run: SimulationRun }) {
  const observations = run.observations ?? []
  const metricSummary = new Map<string, number[]>()
  for (const obs of observations) {
    if (!metricSummary.has(obs.metric)) {
      metricSummary.set(obs.metric, [])
    }
    metricSummary.get(obs.metric)!.push(obs.value)
  }

  return (
    <div className="rounded-md bg-dash-surface p-3">
      <div className="text-xs font-medium text-zinc-200 truncate">
        {run.scenario}
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">
        {observations.length} observations
      </div>
      <div className="mt-2 space-y-1">
        {Array.from(metricSummary.entries())
          .filter(([key]) => key !== "status" && key !== "elapsed_sec")
          .slice(0, 4)
          .map(([metric, values]) => (
            <div
              key={metric}
              className="flex items-center justify-between text-[10px]"
            >
              <span className="text-zinc-500">{metric}</span>
              <span className="font-mono text-zinc-300">
                avg {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
