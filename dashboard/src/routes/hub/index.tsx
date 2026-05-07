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

import {
  HeatmapCalendar,
  type HeatmapIntensity,
  KpiCard,
  LiveDot,
  StatusIcon,
  type StatusIconState,
} from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Code2,
  LineChart,
  RefreshCw,
  SearchCode,
  Upload,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { useAlertsStore } from "@/stores/alerts-store"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"
import { useClusterStore } from "@/stores/cluster-store"
import { useConfigStore } from "@/stores/config-store"

/** Format event/sec values like the mockup ("4.21M", "920K", "440K"). */
function compactCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

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

interface ActivityRow {
  iconColor: "sage" | "coral" | "amber" | "rose" | "teal"
  icon: LucideIcon
  text: React.ReactNode
  time: string
  /** Optional destination — when set, the row renders as a navigable Link. */
  to?: string
  /** Path params for the Link's `to` route. */
  params?: Record<string, string>
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

  /* Engine bars chart — seeded random until `metricSeries` GraphQL is wired
   * (follow-up: fr-server-XX-metric-subscription). */
  const engineBars = useMemo(() => {
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

  /* Heatmap demo data — seeded until checkpoint history aggregation is wired. */
  const heatmapData = useMemo<HeatmapIntensity[]>(() => {
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
        <Link to="/hub/sandbox" className="nav-item w-full">
          <Code2 className="shrink-0" />
          Open sandbox
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
        <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-5">
          <div className="kpi-card">
            <div className="kpi-label">Throughput</div>
            <div className="kpi-value flex items-baseline gap-1">
              <span>—</span>
              <span className="text-[12px] text-fg-muted font-normal">
                evt/s
              </span>
            </div>
            <div className="kpi-sub flex items-center gap-1.5">
              <LiveDot />
              live across {runningJobs.length} pipeline
              {runningJobs.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Watermark lag</div>
            <div className="kpi-value">—</div>
            <div className="kpi-sub">awaiting metric subscription</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Active reactors</div>
            <div className="kpi-value">{slotsUsed}</div>
            <div className="kpi-sub">
              {overview?.taskManagerCount ?? 0} TMs · {slotsTotal} slots ·{" "}
              {slotPct}% util
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Job health</div>
            <div className="kpi-value text-fr-sage">
              {overview?.runningJobs ?? 0}
              <span className="text-[14px] text-fg-muted">
                {" "}
                / {(overview?.runningJobs ?? 0) + (overview?.failedJobs ?? 0)}
              </span>
            </div>
            <div className="kpi-sub">
              {overview?.failedJobs ?? 0} failed · {overview?.finishedJobs ?? 0}{" "}
              finished
            </div>
          </div>
        </div>

        {/* Engine bars chart */}
        <div className="col-span-12 lg:col-span-7">
          <div className="glass-card-static h-full p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                    Streaming engine
                  </h3>
                  <span className="sev-badge muted">demo data</span>
                </div>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  Throughput · last 38 minutes · sage = success, coral = failed
                  checkpoint
                </p>
              </div>
            </div>
            <div className="relative">
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                className="h-44 w-full"
                role="img"
                aria-label="Engine throughput bars (demo data)"
              >
                <g stroke="rgba(212,190,152,0.06)" strokeWidth="1">
                  <line x1="0" y1="45" x2="600" y2="45" />
                  <line x1="0" y1="90" x2="600" y2="90" />
                  <line x1="0" y1="135" x2="600" y2="135" />
                </g>
                <g>
                  {engineBars.map((bar, i) => {
                    const x = (i / engineBars.length) * 600
                    const barWidth = 600 / engineBars.length - 2
                    const y = 180 - bar.height
                    const fill = bar.failed
                      ? "var(--color-fr-coral)"
                      : "var(--color-fr-sage)"
                    return (
                      <rect
                        key={i}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={bar.height}
                        fill={fill}
                        opacity={0.7}
                      />
                    )
                  })}
                </g>
              </svg>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
              <span>38m ago</span>
              <span>
                wire to <code>metricSeries(jobID, metric)</code> in P3
              </span>
              <span>now</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE STRIP ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-[16px] font-medium text-zinc-100">
            Top pipelines
          </h2>
          <Link
            to="/hub/jobs/running"
            className="flex items-center gap-1 text-[12px] text-fr-coral hover:underline"
          >
            View all {runningJobs.length}
            <ArrowRight className="size-3" />
          </Link>
        </div>
        {topPipelines.length === 0 ? (
          <div className="glass-card-static p-6 text-center text-[12px] text-fg-muted">
            No running pipelines.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {topPipelines.map((job) => (
              <Link
                key={job.id}
                to="/hub/jobs/$id"
                params={{ id: job.id }}
                className="glass-card p-4 block"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-sans text-[13px] font-medium text-zinc-100 truncate">
                    {job.name}
                  </span>
                  <span className="status-pill running shrink-0">
                    <LiveDot />
                    Running
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-[20px] text-fg">
                    {compactCount(null)}
                  </span>
                  <span className="text-[10px] text-fg-muted font-mono">
                    evt/s
                  </span>
                </div>
                <div className="mt-2 h-3 w-full">
                  <Sparkline />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-fg-faint">
                  <span>
                    {Object.values(job.tasks).reduce((a, b) => a + b, 0)} tasks
                  </span>
                  <span>p{job.parallelism}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 3-COLUMN: Activity / Instrument health / Alerts ─── */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="glass-card-static p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-heading">Recent activity</h3>
            <Link
              to="/hub/logs"
              className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
            >
              VIEW ALL
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-[11px] text-fg-faint font-mono">
              No recent activity.
            </p>
          ) : (
            <div className="divide-y divide-dash-border/40">
              {activity.map((row, i) => {
                const Icon = row.icon
                const colorClass =
                  row.iconColor === "sage"
                    ? "text-fr-sage"
                    : row.iconColor === "coral"
                      ? "text-fr-coral"
                      : row.iconColor === "amber"
                        ? "text-fr-amber"
                        : row.iconColor === "rose"
                          ? "text-fr-rose"
                          : "text-fr-teal"
                const inner = (
                  <>
                    <div className={`activity-icon ${colorClass}`}>
                      <Icon />
                    </div>
                    <div className="activity-text">{row.text}</div>
                    <div className="activity-time">{row.time}</div>
                  </>
                )
                if (row.to) {
                  return (
                    <Link
                      key={i}
                      to={row.to}
                      params={row.params as never}
                      className="activity-entry hover:bg-dash-elevated/40"
                    >
                      {inner}
                    </Link>
                  )
                }
                return (
                  <div key={i} className="activity-entry">
                    {inner}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Instrument health (demo) */}
        <div className="glass-card-static p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-heading">Instrument health</h3>
            <Link
              to="/hub/instruments"
              className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
            >
              MANAGE
            </Link>
          </div>
          <p className="mb-2 text-[10px] font-mono text-fg-faint">
            wired in P4 — live data via <code>useInstrumentStore</code>
          </p>
          <div className="space-y-1 opacity-60">
            <InstrumentRow name="Fluss" status="OK" sub="—" latency="—" />
            <InstrumentRow name="Paimon" status="OK" sub="—" latency="—" />
            <InstrumentRow name="Redis" status="OK" sub="—" latency="—" />
            <InstrumentRow
              name="Schema Registry"
              status="WARN"
              sub="—"
              latency="—"
            />
            <InstrumentRow name="Datalake" status="OK" sub="—" latency="—" />
          </div>
        </div>

        {/* Recent alerts */}
        <div className="glass-card-static p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-heading">Recent alerts</h3>
            <Link
              to="/hub/monitoring/alerts"
              className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
            >
              VIEW ALL
            </Link>
          </div>
          {activeAlerts.length === 0 ? (
            <p className="text-[11px] text-fg-faint font-mono">
              No active alerts.
            </p>
          ) : (
            <div className="space-y-2">
              {activeAlerts.slice(0, 4).map((alert) => {
                const state: StatusIconState = alert.acknowledged
                  ? "acknowledged"
                  : "firing"
                const sevClass =
                  alert.severity === "critical"
                    ? "text-fr-rose"
                    : alert.severity === "warning"
                      ? "text-fr-coral"
                      : "text-fr-amber"
                const sevLabel = alert.severity.toUpperCase().slice(0, 2)
                return (
                  <Link
                    key={alert.id}
                    to="/hub/monitoring/alerts"
                    className="block rounded-md p-2 hover:bg-dash-elevated/40"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon state={state} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-fg leading-snug">
                          {alert.message}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-fg-faint">
                          <span className={sevClass}>{sevLabel}</span>
                          <span>·</span>
                          <span>{timeAgo(alert.triggeredAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CHECKPOINT HEATMAP (demo) ────────────────────────── */}
      <section className="mb-8">
        <div className="glass-card-static p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                Checkpoint density
              </h3>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                Last 26 weeks · all pipelines · darker = more checkpoints
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-fg-faint">
              <span>less</span>
              <span className="hm-0 inline-block size-3 rounded-sm" />
              <span className="hm-1 inline-block size-3 rounded-sm" />
              <span className="hm-2 inline-block size-3 rounded-sm" />
              <span className="hm-3 inline-block size-3 rounded-sm" />
              <span className="hm-4 inline-block size-3 rounded-sm" />
              <span>more</span>
            </div>
          </div>
          <HeatmapCalendar data={heatmapData} weeks={26} />
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
            <span>26 weeks ago</span>
            <span>
              demo · wire to <code>checkpointHistory</code> in P3
            </span>
            <span>now</span>
          </div>
        </div>
      </section>
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

function InstrumentRow({
  name,
  status,
  sub,
  latency,
}: {
  name: string
  status: "OK" | "WARN" | "FAIL"
  sub: string
  latency: string
}) {
  const tone =
    status === "OK"
      ? "text-fr-sage"
      : status === "WARN"
        ? "text-fr-amber"
        : "text-fr-rose"
  const Icon = status === "OK" ? CheckCircle2 : AlertTriangle
  return (
    <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 rounded-md p-2 hover:bg-dash-elevated/40">
      <Icon className={`size-4 ${tone}`} />
      <div>
        <div className="text-[12.5px] text-fg">{name}</div>
        <div className="text-[10px] text-fg-faint font-mono">{sub}</div>
      </div>
      <span className={`font-mono text-[10px] ${tone}`}>{status}</span>
      <span className="font-mono text-[10px] text-fg-faint text-right w-10">
        {latency}
      </span>
    </div>
  )
}

/** Generic flat sparkline placeholder until per-job throughput history lands. */
function Sparkline() {
  return (
    <svg
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      className="h-3 w-full"
      role="img"
      aria-label="throughput sparkline (placeholder)"
    >
      <polyline
        points="0,9 10,9 20,9 30,9 40,9 50,9 60,9 70,9 80,9 90,9 100,9"
        fill="none"
        stroke="var(--color-fr-sage)"
        strokeWidth="1.2"
        opacity="0.4"
      />
    </svg>
  )
}

export const Route = createFileRoute("/hub/")({
  component: HubOverview,
})
