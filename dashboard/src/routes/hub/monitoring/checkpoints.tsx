/**
 * Hub checkpoints — /hub/monitoring/checkpoints.
 *
 * Mirrors `console-v2/checkpoints.html`: KPI strip, engine-bars chart by state,
 * recent checkpoint events table, density heatmap, per-pipeline summary,
 * and savepoints list. Bars come from `useEngineBarsData` (metricSeries)
 * with per-minute failure overlay from `useCheckpointFailureBuckets`
 * (checkpointHistory). No seeded fallbacks — empty states render explicitly.
 */

import { HubBreadcrumb, LiveDot } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { useEffect, useMemo, useState } from "react"
import { CheckpointDensityHeatmap } from "@/components/hub/checkpoints/checkpoint-density-heatmap"
import { SavepointsList } from "@/components/hub/checkpoints/savepoints-list"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useCheckpointFailureBuckets } from "@/lib/hub/use-checkpoint-failure-buckets"
import { useClusterSavepoints } from "@/lib/hub/use-cluster-savepoints"
import {
  type EngineBar,
  useEngineBarsData,
} from "@/lib/hub/use-engine-bars-data"
import {
  type JobCheckpointSummary,
  useCheckpointAnalyticsStore,
} from "@/stores/checkpoint-analytics-store"
import { useClusterStore } from "@/stores/cluster-store"
import { useConfigStore } from "@/stores/config-store"

function compactCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—"
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function HubMonitoringCheckpoints() {
  const initialize = useCheckpointAnalyticsStore((s) => s.initialize)
  const startPolling = useCheckpointAnalyticsStore((s) => s.startPolling)
  const stopPolling = useCheckpointAnalyticsStore((s) => s.stopPolling)
  const summaries = useCheckpointAnalyticsStore((s) => s.summaries)
  const aggregates = useCheckpointAnalyticsStore((s) => s.aggregates)
  const checkpointsConfigured = useCheckpointAnalyticsStore(
    (s) => s.checkpointsConfigured,
  )
  const initCluster = useClusterStore((s) => s.initialize)
  const startCluster = useClusterStore((s) => s.startPolling)
  const stopCluster = useClusterStore((s) => s.stopPolling)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const config = useConfigStore((s) => s.config)
  const clusterID = config?.clusters?.[0] ?? null
  const liveBars = useEngineBarsData(clusterID, { minutes: 38 })
  const failureBuckets = useCheckpointFailureBuckets(clusterID, { minutes: 38 })
  const savepointsResult = useClusterSavepoints(runningJobs)

  useEffect(() => {
    initCluster()
    startCluster()
    initialize()
    startPolling()
    return () => {
      stopPolling()
      stopCluster()
    }
  }, [
    initCluster,
    startCluster,
    stopCluster,
    initialize,
    startPolling,
    stopPolling,
  ])

  // Merge per-minute failure counts into the engine bars. The failure map
  // keys (floor-to-minute ms epoch) align with each bar's `bucketStart`.
  const bars: EngineBar[] = useMemo(() => {
    if (failureBuckets.buckets.size === 0) return liveBars.bars
    return liveBars.bars.map((bar) => ({
      ...bar,
      failed: (failureBuckets.buckets.get(bar.bucketStart.getTime()) ?? 0) > 0,
    }))
  }, [liveBars.bars, failureBuckets.buckets])

  const barsLoading = liveBars.loading
  const barsEmpty =
    !liveBars.loading && (liveBars.empty || liveBars.bars.length === 0)
  const barsErrorMessage = liveBars.error

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const recentEvents = useMemo(() => {
    return summaries
      .flatMap((s) => s.recentCheckpoints.map((cp) => ({ summary: s, cp })))
      .sort(
        (a, b) =>
          b.cp.triggerTimestamp.getTime() - a.cp.triggerTimestamp.getTime(),
      )
      .slice(0, 8)
  }, [summaries])

  const totalState = aggregates?.totalStateSize ?? 0
  const totalCkpts = aggregates?.totalCheckpoints ?? 0
  const successRate = aggregates?.overallSuccessRate ?? null
  const avgDuration = aggregates?.avgDuration ?? null

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Observe" }, { label: "Checkpoints" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Checkpoint analytics
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            All pipelines · {compactCount(totalCkpts)} checkpoints ·{" "}
            {successRate == null ? "—" : `${successRate.toFixed(3)}%`} success ·
            avg {formatDuration(avgDuration)}
          </p>
        </div>
      </div>

      {!checkpointsConfigured ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fg-muted">
          Checkpointing is not configured on the running pipelines.
        </div>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiTile
              label="Total ckpts"
              value={compactCount(totalCkpts)}
              sub="lifetime · running jobs"
            />
            <KpiTile
              label="Success rate"
              value={successRate == null ? "—" : `${successRate.toFixed(2)}%`}
              tone={
                successRate == null
                  ? undefined
                  : successRate >= 99.9
                    ? "sage"
                    : successRate >= 95
                      ? "amber"
                      : "rose"
              }
            />
            <KpiTile label="Avg duration" value={formatDuration(avgDuration)} />
            <KpiTile
              label="State size"
              value={formatBytes(totalState)}
              sub={`across ${summaries.length} pipeline${summaries.length === 1 ? "" : "s"}`}
            />
            <KpiTile
              label="Active pipelines"
              value={summaries.filter((s) => s.totalCheckpoints > 0).length}
            />
          </section>

          {/* Engine bars chart */}
          <section className="mb-6 glass-card-static p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                  Checkpoint outcomes — last 38 minutes
                </h3>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  sage = success, coral = failed
                </p>
              </div>
              {barsLoading ? (
                <span className="sev-badge muted">loading</span>
              ) : barsErrorMessage ? (
                <span className="sev-badge fail" title={barsErrorMessage}>
                  error
                </span>
              ) : barsEmpty ? (
                <span
                  className="sev-badge muted"
                  title="no numRecordsOutPerSecond series in storage yet"
                >
                  no data yet
                </span>
              ) : (
                <span className="sev-badge ok inline-flex items-center gap-1.5">
                  <LiveDot />
                  Live
                </span>
              )}
            </div>
            <div className="relative" onMouseLeave={() => setHoverIdx(null)}>
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                className="h-44 w-full"
                role="img"
                aria-label="Checkpoint outcome bars over the last 38 minutes"
              >
                <g stroke="rgba(212,190,152,0.06)" strokeWidth="1">
                  <line x1="0" y1="45" x2="600" y2="45" />
                  <line x1="0" y1="90" x2="600" y2="90" />
                  <line x1="0" y1="135" x2="600" y2="135" />
                </g>
                {barsLoading ? (
                  <g opacity={0.3}>
                    {Array.from({ length: 38 }, (_, i) => {
                      const x = (i / 38) * 600
                      const w = 600 / 38 - 2
                      return (
                        <rect
                          // biome-ignore lint/suspicious/noArrayIndexKey: positional skeleton
                          key={i}
                          x={x}
                          y={150}
                          width={w}
                          height={30}
                          fill="var(--color-fr-sage)"
                          opacity={0.4}
                        />
                      )
                    })}
                  </g>
                ) : (
                  <g>
                    {bars.map((bar, i) => {
                      const x = (i / Math.max(bars.length, 1)) * 600
                      const w = 600 / Math.max(bars.length, 1) - 2
                      const y = 180 - bar.height
                      const fill = bar.failed
                        ? "var(--color-fr-coral)"
                        : "var(--color-fr-sage)"
                      const active = hoverIdx === i
                      return (
                        <rect
                          // biome-ignore lint/suspicious/noArrayIndexKey: positional bar
                          key={i}
                          x={x}
                          y={y}
                          width={w}
                          height={bar.height}
                          fill={fill}
                          opacity={active ? 1 : 0.7}
                          onMouseEnter={() => setHoverIdx(i)}
                        />
                      )
                    })}
                  </g>
                )}
              </svg>
              {barsEmpty ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-mono text-fg-muted">
                    Collecting metrics — first bars appear after ~60s
                  </span>
                </div>
              ) : null}
              {!barsLoading &&
              !barsEmpty &&
              hoverIdx != null &&
              bars[hoverIdx] ? (
                <div
                  className={`engine-callout pointer-events-none whitespace-nowrap${
                    bars[hoverIdx].failed ? " failed" : ""
                  }`}
                  style={{
                    left: `${((hoverIdx + 0.5) / bars.length) * 100}%`,
                    top: `${((180 - bars[hoverIdx].height) / 180) * 100}%`,
                    transform: "translate(-50%, calc(-100% - 8px))",
                  }}
                >
                  <div className="text-fg-faint">
                    {format(bars[hoverIdx].bucketStart, "HH:mm")}
                  </div>
                  <div>{compactCount(bars[hoverIdx].value)} rec/s</div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <div className="glass-card-static p-5">
                <h3 className="font-sans text-[14px] font-medium text-zinc-100 mb-3">
                  Recent checkpoint events
                </h3>
                {recentEvents.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-fg-muted">
                    No checkpoint events recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase tracking-wider text-fg-faint border-b border-dash-border">
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Pipeline</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Duration</th>
                          <th className="px-3 py-2 text-right">Size</th>
                          <th className="px-3 py-2 text-right">Trigger</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dash-border/40">
                        {recentEvents.map(({ summary, cp }) => {
                          const statusClass =
                            cp.status === "COMPLETED"
                              ? "text-fr-sage"
                              : cp.status === "FAILED"
                                ? "text-fr-rose"
                                : "text-fr-amber"
                          return (
                            <tr
                              key={`${summary.jobId}-${cp.id}`}
                              className="hover:bg-dash-elevated/30"
                            >
                              <td className="px-3 py-2 font-mono text-fg-muted">
                                {cp.id}
                              </td>
                              <td className="px-3 py-2">
                                <Link
                                  to="/hub/jobs/$id"
                                  params={{ id: summary.jobId }}
                                  className="font-mono text-fg hover:text-fr-coral"
                                >
                                  {summary.jobName}
                                </Link>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`font-mono text-[10px] ${statusClass}`}
                                >
                                  {cp.isSavepoint ? "SAVEPOINT" : cp.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatDuration(cp.duration)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatBytes(cp.size)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-fg-faint">
                                {timeAgo(cp.triggerTimestamp)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-5">
              <div className="glass-card-static p-5">
                <h3 className="section-heading mb-3">
                  Density · last 26 weeks
                </h3>
                <CheckpointDensityHeatmap weeks={26} />
              </div>

              <div className="glass-card-static p-5">
                <h3 className="section-heading mb-3">Per-pipeline summary</h3>
                <PerPipelineSummary summaries={summaries} />
              </div>

              <div className="glass-card-static p-5">
                <h3 className="section-heading mb-3">Savepoints (recent)</h3>
                <SavepointsList
                  rows={savepointsResult.rows}
                  loading={savepointsResult.loading}
                  limit={8}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </HubAppShell>
  )
}

function PerPipelineSummary({
  summaries,
}: {
  summaries: JobCheckpointSummary[]
}) {
  if (summaries.length === 0) {
    return (
      <p className="text-[11px] font-mono text-fg-faint">
        No pipelines reporting checkpoints.
      </p>
    )
  }
  return (
    <div className="space-y-2 text-[12px]">
      {summaries.slice(0, 8).map((s) => {
        const tone =
          s.successRate >= 99.9
            ? "text-fg"
            : s.successRate >= 95
              ? "text-fr-amber"
              : "text-fr-rose"
        return (
          <div
            key={s.jobId}
            className="flex items-center justify-between gap-2"
          >
            <Link
              to="/hub/jobs/$id"
              params={{ id: s.jobId }}
              className="font-mono text-fg-muted hover:text-fr-coral truncate"
            >
              {s.jobName}
            </Link>
            <span className={`font-mono shrink-0 ${tone}`}>
              {compactCount(s.totalCheckpoints)} ·{" "}
              {s.successRate.toFixed(s.successRate >= 99.99 ? 3 : 2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  tone?: "sage" | "amber" | "rose"
}

function KpiTile({ label, value, sub, tone }: KpiTileProps) {
  const valueClass =
    tone === "sage"
      ? "text-fr-sage"
      : tone === "amber"
        ? "text-fr-amber"
        : tone === "rose"
          ? "text-fr-rose"
          : ""
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  )
}

export const Route = createFileRoute("/hub/monitoring/checkpoints")({
  component: HubMonitoringCheckpoints,
})
