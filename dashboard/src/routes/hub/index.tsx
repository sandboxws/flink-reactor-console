/**
 * Hub overview — /hub landing page.
 *
 * Mirrors `console-v2/overview.html` exactly. Real data comes from existing
 * Zustand stores (cluster, alerts, bg-deployment, config). Values without a
 * backing store yet (real-time throughput, watermark lag, SLO, engine bars,
 * checkpoint heatmap, instrument health) render as "—" with a small "demo"
 * affordance — see `fr-server-XX-metric-subscription` and `fr-server-XX-alerts-engine`
 * follow-ups for the missing pipes.
 *
 * After cutover (fr-console-hub-cutover) this file moves to /overview.
 */

import { type HeatmapIntensity, KpiCard, LiveDot } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Code2,
  LineChart,
  RefreshCw,
  SearchCode,
  Upload,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo } from "react"
import {
  ActivityFeed,
  type ActivityRow,
} from "@/components/hub/overview/activity-feed"
import { CheckpointHeatmap } from "@/components/hub/overview/checkpoint-heatmap"
import { EngineBarsChart } from "@/components/hub/overview/engine-bars-chart"
import { InstrumentHealthList } from "@/components/hub/overview/instrument-health-list"
import { OverviewKpiQuad } from "@/components/hub/overview/overview-kpi-quad"
import { RecentAlertsCard } from "@/components/hub/overview/recent-alerts-card"
import { TopPipelinesGrid } from "@/components/hub/overview/top-pipelines-grid"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { useCheckpointDensity } from "@/lib/hub/use-checkpoint-density"
import { useEngineBarsData } from "@/lib/hub/use-engine-bars-data"
import { useAlertsStore } from "@/stores/alerts-store"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"
import { useClusterStore } from "@/stores/cluster-store"
import { useConfigStore } from "@/stores/config-store"

/** Format the relative time for activity rows ("2m ago", "1h ago"). */
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Display name for a blue-green deployment state, matching mockup tone. */
function deploymentStateLabel(state: string): string {
  switch (state) {
    case "INITIALIZING_BLUE":
      return "initializing"
    case "ACTIVE_BLUE":
    case "ACTIVE_GREEN":
      return "active"
    case "SAVEPOINTING_BLUE":
    case "SAVEPOINTING_GREEN":
      return "savepointing"
    case "TRANSITIONING_TO_BLUE":
    case "TRANSITIONING_TO_GREEN":
      return "shifting traffic"
    default:
      return state.toLowerCase()
  }
}

function HubOverview() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const fetchDeployments = useBgDeploymentStore((s) => s.fetchDeployments)
  const initAlerts = useAlertsStore((s) => s.initialize)
  const stopAlerts = useAlertsStore((s) => s.stopListening)

  const overview = useClusterStore((s) => s.overview)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const completedJobs = useClusterStore((s) => s.completedJobs)
  const lastUpdated = useClusterStore((s) => s.lastUpdated)
  const fetchError = useClusterStore((s) => s.fetchError)
  const refresh = useClusterStore((s) => s.refresh)
  const config = useConfigStore((s) => s.config)
  const deployments = useBgDeploymentStore((s) => s.deployments)
  const activeAlerts = useAlertsStore((s) => s.activeAlerts)

  useEffect(() => {
    initialize()
    startPolling()
    fetchDeployments()
    initAlerts()
    return () => {
      stopPolling()
      stopAlerts()
    }
  }, [
    initialize,
    startPolling,
    stopPolling,
    fetchDeployments,
    initAlerts,
    stopAlerts,
  ])

  const slotsUsed = overview
    ? overview.totalTaskSlots - overview.availableTaskSlots
    : 0
  const slotPct = overview?.totalTaskSlots
    ? Math.round((slotsUsed / overview.totalTaskSlots) * 100)
    : 0

  const topPipelines = useMemo(() => runningJobs.slice(0, 4), [runningJobs])

  /* Compose activity feed from existing stores: recent failed/finished jobs,
   * recent deployments, recent alerts. Sorted by recency, top N. */
  const activity: ActivityRow[] = useMemo(() => {
    const rows: { sortKey: number; row: ActivityRow }[] = []

    for (const job of completedJobs.slice(0, 6)) {
      const isFailure = job.status === "FAILED" || job.status === "CANCELED"
      const ms = job.endTime?.getTime() ?? job.startTime.getTime()
      rows.push({
        sortKey: ms,
        row: {
          iconColor: isFailure ? "rose" : "sage",
          icon: isFailure ? XCircle : CheckCircle2,
          text: (
            <>
              Job <strong>{job.name}</strong>{" "}
              {isFailure ? "failed" : "finished"}
            </>
          ),
          time: timeAgo(job.endTime ?? job.startTime),
          to: "/hub/jobs/$id",
          params: { id: job.id },
        },
      })
    }

    for (const dep of deployments.slice(0, 6)) {
      const ts = dep.lastReconciledTimestamp
        ? new Date(dep.lastReconciledTimestamp).getTime()
        : Date.now()
      rows.push({
        sortKey: ts,
        row: {
          iconColor: "coral",
          icon: ArrowLeftRight,
          text: (
            <>
              Deployment <strong>{dep.name}</strong>{" "}
              {deploymentStateLabel(dep.state)}
            </>
          ),
          time: timeAgo(dep.lastReconciledTimestamp),
          to: "/hub/deployments/$name",
          params: { name: dep.name },
        },
      })
    }

    for (const alert of activeAlerts.slice(0, 6)) {
      rows.push({
        sortKey: alert.triggeredAt.getTime(),
        row: {
          iconColor: "amber",
          icon: AlertTriangle,
          text: <>{alert.message}</>,
          time: timeAgo(alert.triggeredAt),
          to: "/hub/monitoring/alerts",
        },
      })
    }

    rows.sort((a, b) => b.sortKey - a.sortKey)
    return rows.slice(0, 6).map((r) => r.row)
  }, [completedJobs, deployments, activeAlerts])

  const clusterID = config?.clusters?.[0] ?? null

  /* Engine bars — driven by `metricSeries` when the storage backend has
   * `numRecordsOutPerSecond` data, otherwise falls back to seeded demo
   * bars so the page never renders empty. The hook tells us via `empty`
   * which case we're in. */
  const liveEngineBars = useEngineBarsData(clusterID, { minutes: 38 })
  const demoEngineBars = useMemo(() => {
    const seeded = (n: number) => {
      const x = Math.sin(n * 7.3) * 10000
      return x - Math.floor(x)
    }
    return Array.from({ length: 38 }, (_, i) => {
      const r = seeded(i + 1)
      const height = 30 + r * 130
      const failed = i % 9 === 3 || i % 11 === 7
      return { height, failed }
    })
  }, [])
  /* Use live bars only when we got real data back; otherwise stay on demo
   * regardless of whether the cause was empty storage or a network error. */
  const useLiveEngineBars =
    !liveEngineBars.loading &&
    !liveEngineBars.empty &&
    !liveEngineBars.error &&
    liveEngineBars.bars.length > 0
  const engineBars = useLiveEngineBars ? liveEngineBars.bars : demoEngineBars
  const engineBarsAreDemo = !useLiveEngineBars

  /* Heatmap — driven by `checkpointHistory` aggregated per local day.
   * Falls back to seeded demo data when storage is empty/unavailable. */
  const liveHeatmap = useCheckpointDensity(clusterID, { days: 26 * 7 })
  const demoHeatmap = useMemo<HeatmapIntensity[]>(() => {
    const seeded = (n: number) => {
      const x = Math.sin(n * 13.7) * 10000
      return x - Math.floor(x)
    }
    return Array.from({ length: 26 * 7 }, (_, i) => {
      const r = seeded(i + 1)
      if (r < 0.25) return 0
      if (r < 0.5) return 1
      if (r < 0.72) return 2
      if (r < 0.9) return 3
      return 4
    }) as HeatmapIntensity[]
  }, [])
  const useLiveHeatmap =
    !liveHeatmap.loading &&
    !liveHeatmap.empty &&
    !liveHeatmap.error &&
    liveHeatmap.data.length > 0
  const heatmapData = useLiveHeatmap ? liveHeatmap.data : demoHeatmap
  const heatmapIsDemo = !useLiveHeatmap

  const flinkVersion = overview?.flinkVersion ?? "—"
  const clusterName = config?.clusterDisplayName ?? "cluster"
  const region = "—" // Not in current overview store
  const slotsTotal = overview?.totalTaskSlots ?? 0

  const rail = (
    <>
      <h3 className="section-heading mb-3">Live</h3>
      <div className="space-y-3">
        <KpiCard
          label="Throughput"
          liveDot="sage"
          value={
            <span className="flex items-baseline gap-1">
              <span>—</span>
              <span className="text-[10px] font-normal text-fg-muted">
                evt/s
              </span>
            </span>
          }
          sub={
            lastUpdated
              ? `polled ${timeAgo(lastUpdated)}`
              : "awaiting first poll"
          }
        />
        <KpiCard
          label="Slot utilization"
          value={
            <span className="font-mono text-[18px] text-fg">
              {slotsUsed}
              <span className="text-fg-faint">/{slotsTotal}</span>
            </span>
          }
          sub={`${slotPct}% · ${overview?.taskManagerCount ?? 0} TMs`}
        >
          <div className="resource-bar mt-2">
            <div className="seg heap" style={{ width: `${slotPct}%` }} />
            <div className="seg free" style={{ width: `${100 - slotPct}%` }} />
          </div>
        </KpiCard>
        <KpiCard
          label="Active jobs"
          value={overview?.runningJobs ?? 0}
          sub={`${overview?.finishedJobs ?? 0} finished · ${overview?.failedJobs ?? 0} failed`}
        />
      </div>

      <h3 className="section-heading mb-3 mt-6">Cluster</h3>
      <div className="space-y-2 text-[12px]">
        <RailRow label="Flink version" value={flinkVersion} />
        <RailRow label="Reactor" value={config?.clusters?.[0] ?? "—"} />
        <RailRow label="Region" value={region} />
        <RailRow
          label="Task managers"
          value={String(overview?.taskManagerCount ?? "—")}
        />
        <RailRow
          label="Last poll"
          value={lastUpdated ? timeAgo(lastUpdated) : "—"}
        />
      </div>

      <h3 className="section-heading mb-3 mt-6">Quick actions</h3>
      <div className="space-y-1.5">
        <Link to="/hub/jobs/submit" className="nav-item w-full">
          <Upload className="shrink-0" />
          Submit JAR
        </Link>
        <Link to="/hub/sandbox/editor" className="nav-item w-full">
          <Code2 className="shrink-0" />
          Open DSL editor
        </Link>
        <Link to="/hub/sql-explorer" className="nav-item w-full">
          <SearchCode className="shrink-0" />
          SQL explorer
        </Link>
        <Link to="/hub/insights/metrics" className="nav-item w-full">
          <LineChart className="shrink-0" />
          Build metric
        </Link>
      </div>
    </>
  )

  return (
    <HubAppShell rail={rail}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-fg-muted">
            <span className="font-mono">{clusterName}</span>
            <span className="text-fg-faint">·</span>
            <span className="font-mono">v{flinkVersion}</span>
          </div>
          <h1 className="mt-1 font-sans text-[28px] font-semibold tracking-tight text-zinc-100">
            Cluster overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ClusterHealthPill
            healthy={!fetchError && (overview?.failedJobs ?? 0) === 0}
            failedJobs={overview?.failedJobs ?? 0}
            error={fetchError}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refresh()}
          >
            <RefreshCw className="shrink-0" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── HERO: KPI quad + Engine bars chart ──────────────────── */}
      <section className="mb-8 grid grid-cols-12 gap-4">
        <OverviewKpiQuad
          runningJobsCount={runningJobs.length}
          slotsUsed={slotsUsed}
          slotsTotal={slotsTotal}
          slotPct={slotPct}
          taskManagerCount={overview?.taskManagerCount ?? 0}
          jobsRunning={overview?.runningJobs ?? 0}
          jobsFinished={overview?.finishedJobs ?? 0}
          jobsFailed={overview?.failedJobs ?? 0}
        />
        <EngineBarsChart
          bars={engineBars}
          isDemo={engineBarsAreDemo}
          errorMessage={liveEngineBars.error}
        />
      </section>

      {/* ── PIPELINE STRIP ─────────────────────────────────────── */}
      <TopPipelinesGrid
        pipelines={topPipelines}
        totalRunningCount={runningJobs.length}
      />

      {/* ── 3-COLUMN: Activity / Instrument health / Alerts ─── */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActivityFeed rows={activity} />
        <InstrumentHealthList />
        <RecentAlertsCard alerts={activeAlerts} />
      </section>

      {/* ── CHECKPOINT HEATMAP ────────────────────────────────── */}
      <CheckpointHeatmap
        data={heatmapData}
        weeks={26}
        isDemo={heatmapIsDemo}
        errorMessage={liveHeatmap.error}
      />
    </HubAppShell>
  )
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono text-fg truncate ml-2">{value}</span>
    </div>
  )
}

function ClusterHealthPill({
  healthy,
  failedJobs,
  error,
}: {
  healthy: boolean
  failedJobs: number
  error: string | null
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-fr-rose/10 border border-fr-rose/30 px-3 py-1 text-[11px] font-mono text-fr-rose">
        <AlertTriangle className="size-3" />
        Connection error
      </span>
    )
  }
  if (!healthy) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-fr-coral/10 border border-fr-coral/30 px-3 py-1 text-[11px] font-mono text-fr-coral">
        <AlertTriangle className="size-3" />
        {failedJobs} failed job{failedJobs === 1 ? "" : "s"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fr-sage/10 border border-fr-sage/30 px-3 py-1 text-[11px] font-mono text-fr-sage">
      <LiveDot />
      All systems nominal
    </span>
  )
}

export const Route = createFileRoute("/hub/")({
  component: HubOverview,
})
