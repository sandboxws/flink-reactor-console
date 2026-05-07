/**
 * Hub health — /hub/insights/health.
 *
 * Mirrors `console-v2/health.html`: 4 health rings (cluster overall, pipelines,
 * resources, instruments) + pipeline health rows + resource pressure gauges +
 * detected issues. Backed by `useInsightsStore` (composite score + sub-scores
 * + issues) and `useClusterStore` (jobs + task managers).
 */

import {
  type FlinkJob,
  HubBreadcrumb,
  type TaskManager,
} from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertTriangle, Check, Info, XCircle } from "lucide-react"
import { useEffect, useMemo } from "react"
import { HealthRings } from "@/components/hub/insights/health-rings"
import { ResourceGauges } from "@/components/hub/insights/resource-gauges"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useInsightsStore } from "@/stores/insights-store"

function HubInsightsHealth() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startCluster = useClusterStore((s) => s.startPolling)
  const stopCluster = useClusterStore((s) => s.stopPolling)
  const initInsights = useInsightsStore((s) => s.initialize)
  const startInsights = useInsightsStore((s) => s.startPolling)
  const stopInsights = useInsightsStore((s) => s.stopPolling)

  const overview = useClusterStore((s) => s.overview)
  const taskManagers = useClusterStore((s) => s.taskManagers)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const currentHealth = useInsightsStore((s) => s.currentHealth)
  const issues = useInsightsStore((s) => s.issues)
  const healthLoading = useInsightsStore((s) => s.healthLoading)

  useEffect(() => {
    initCluster()
    startCluster()
    initInsights()
    startInsights()
    return () => {
      stopInsights()
      stopCluster()
    }
  }, [
    initCluster,
    startCluster,
    stopCluster,
    initInsights,
    startInsights,
    stopInsights,
  ])

  const rings = useMemo(() => {
    const overall = currentHealth?.score ?? 0
    const pipelinesHealthy = runningJobs.filter(
      (j) => j.status === "RUNNING",
    ).length
    const pipelinesTotal = runningJobs.length
    const pipelinesPct =
      pipelinesTotal > 0 ? (pipelinesHealthy / pipelinesTotal) * 100 : 0

    let heapMax = 0
    let heapUsed = 0
    for (const tm of taskManagers) {
      heapMax += tm.metrics.heapMax
      heapUsed += tm.metrics.heapUsed
    }
    const resourcePct = heapMax > 0 ? 100 - (heapUsed / heapMax) * 100 : 0

    const slotPct =
      overview && overview.totalTaskSlots > 0
        ? ((overview.totalTaskSlots - overview.availableTaskSlots) /
            overview.totalTaskSlots) *
          100
        : 0

    return [
      {
        label: "Cluster",
        value: overall,
        sub: `${taskManagers.length} task manager${taskManagers.length === 1 ? "" : "s"}`,
      },
      {
        label: "Pipelines",
        value: pipelinesPct,
        sub: `${pipelinesHealthy}/${pipelinesTotal} running`,
      },
      {
        label: "Resources",
        value: resourcePct,
        sub: `${heapMax > 0 ? Math.round((heapUsed / heapMax) * 100) : 0}% heap used`,
      },
      {
        label: "Slot capacity",
        value: 100 - slotPct,
        sub: `${overview?.availableTaskSlots ?? 0} free / ${overview?.totalTaskSlots ?? 0}`,
      },
    ]
  }, [currentHealth, runningJobs, taskManagers, overview])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Observe" }, { label: "Health" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Cluster health
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {healthLoading
              ? "computing health snapshot..."
              : `composite score ${(currentHealth?.score ?? 0).toFixed(0)}/100 · ${issues.length} active issue${issues.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {/* Hero rings */}
      <div className="mb-6">
        <HealthRings rings={rings} />
      </div>

      <section className="grid grid-cols-12 gap-5">
        {/* Pipelines + resource pressure */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          <div className="glass-card-static p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                Pipeline health
              </h3>
              <span className="font-mono text-[10px] text-fg-faint">
                live · auto-refresh
              </span>
            </div>
            {runningJobs.length === 0 ? (
              <p className="text-[11px] font-mono text-fg-faint">
                No running pipelines.
              </p>
            ) : (
              <div className="space-y-1">
                {runningJobs.map((job) => (
                  <PipelineHealthRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>

          <div className="glass-card-static p-5">
            <h3 className="font-sans text-[14px] font-medium text-zinc-100 mb-3">
              Resource pressure · cluster average
            </h3>
            <ResourceGauges taskManagers={taskManagers} />
          </div>
        </div>

        {/* Sub-scores + issues */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Health dimensions</h3>
            {currentHealth ? (
              <div className="space-y-2">
                {currentHealth.subScores.map((s) => {
                  const tone =
                    s.status === "healthy"
                      ? "text-fr-sage"
                      : s.status === "warning"
                        ? "text-fr-amber"
                        : "text-fr-rose"
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="text-fg-muted truncate">{s.name}</span>
                      <span className={`font-mono shrink-0 ${tone}`}>
                        {Math.round(s.score)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] font-mono text-fg-faint">
                Waiting for first snapshot…
              </p>
            )}
          </div>

          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Active issues</h3>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-[12px] text-fg-muted">
                <Check className="size-4 text-fr-sage" />
                No issues detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {issues.slice(0, 8).map((i) => {
                  const Icon =
                    i.severity === "critical"
                      ? XCircle
                      : i.severity === "warning"
                        ? AlertTriangle
                        : Info
                  const tone =
                    i.severity === "critical"
                      ? "text-fr-rose"
                      : i.severity === "warning"
                        ? "text-fr-amber"
                        : "text-fr-coral"
                  return (
                    <li
                      key={i.id}
                      className="flex items-start gap-2 text-[12px]"
                    >
                      <Icon className={`shrink-0 size-4 mt-0.5 ${tone}`} />
                      <div className="min-w-0">
                        <div className="text-fg leading-snug">{i.message}</div>
                        <div className="font-mono text-[10px] text-fg-faint mt-0.5">
                          {i.source}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </HubAppShell>
  )
}

function PipelineHealthRow({ job }: { job: FlinkJob }) {
  const failed = job.status === "FAILED" || job.status === "FAILING"
  const warn = job.status === "RESTARTING" || job.status === "RECONCILING"
  const tone = failed ? "text-fr-rose" : warn ? "text-fr-amber" : "text-fr-sage"
  const badge = failed ? "FAIL" : warn ? "WARN" : "OK"
  const Icon = failed ? XCircle : warn ? AlertTriangle : Check
  const totalTasks = Object.values(job.tasks).reduce((s, n) => s + n, 0)
  const ok = totalTasks > 0 ? (job.tasks.running / totalTasks) * 100 : 0

  return (
    <Link
      to="/hub/jobs/$id"
      params={{ id: job.id }}
      className="grid grid-cols-[20px_1fr_auto_70px] items-center gap-2 rounded-md px-2 py-2 hover:bg-dash-elevated/40"
    >
      <Icon className={`size-4 ${tone}`} />
      <div className="min-w-0">
        <div className="text-[12.5px] text-fg truncate">{job.name}</div>
        <div className="text-[10px] font-mono text-fg-faint">
          p{job.parallelism} · {job.tasks.running}/{totalTasks} tasks running
        </div>
      </div>
      <span className={`font-mono text-[10px] ${tone}`}>{badge}</span>
      <span
        className={`font-mono text-[10px] text-right ${tone === "text-fr-sage" ? "text-fg-faint" : tone}`}
      >
        {ok.toFixed(1)}%
      </span>
    </Link>
  )
}

// `taskManagers` typing exposed for use in PipelineHealthRow tooltips later.
export type { TaskManager }

export const Route = createFileRoute("/hub/insights/health")({
  component: HubInsightsHealth,
})
