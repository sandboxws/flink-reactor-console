/**
 * Overview KPI quad — the 2×2 metric card grid above the engine-bars chart.
 *
 * Four KPIs, all sourced from live polled data:
 *  - Throughput     — Σ recordsOutPerSecond across all source vertices
 *  - Watermark lag  — worst-case lag (now − min watermark)
 *  - Active reactors — `taskManagers.length`
 *  - Job health     — running / running+failed
 *
 * Throughput and Watermark render `"—"` honestly when no running jobs have
 * reported metrics yet; never as a placeholder when real data is available.
 */

import { LiveDot } from "@flink-reactor/ui"

interface OverviewKpiQuadProps {
  /** Number of running pipelines, used for the throughput live-dot caption. */
  runningJobsCount: number
  /** Σ recordsOutPerSecond across source vertices; null when no signal. */
  throughputEvtPerSec: number | null
  /** Worst-case watermark lag in ms; null when no signal. */
  watermarkLagMs: number | null
  /** Number of task managers (= active reactors). */
  taskManagerCount: number
  /** Total task slots across the cluster. */
  slotsTotal: number
  /** Active task slots = total − available. */
  slotsUsed: number
  /** % of slots used. */
  slotPct: number
  jobsRunning: number
  jobsFinished: number
  jobsFailed: number
}

/** Format a per-second rate as a compact human-readable value. */
function formatRate(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

/** Format ms as a compact lag duration. */
function formatLag(ms: number | null): { value: string; unit: string } {
  if (ms === null || !Number.isFinite(ms)) return { value: "—", unit: "" }
  if (ms < 1000) return { value: `${Math.round(ms)}`, unit: "ms" }
  if (ms < 60_000) return { value: `${(ms / 1000).toFixed(1)}`, unit: "s" }
  return { value: `${Math.round(ms / 60_000)}`, unit: "m" }
}

export function OverviewKpiQuad({
  runningJobsCount,
  throughputEvtPerSec,
  watermarkLagMs,
  taskManagerCount,
  slotsTotal,
  slotsUsed,
  slotPct,
  jobsRunning,
  jobsFinished,
  jobsFailed,
}: OverviewKpiQuadProps) {
  const lag = formatLag(watermarkLagMs)
  return (
    <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-5">
      <div className="kpi-card">
        <div className="kpi-label">Throughput</div>
        <div className="kpi-value flex items-baseline gap-1">
          <span>{formatRate(throughputEvtPerSec)}</span>
          <span className="text-[12px] text-fg-muted font-normal">evt/s</span>
        </div>
        <div className="kpi-sub flex items-center gap-1.5">
          <LiveDot />
          live across {runningJobsCount} pipeline
          {runningJobsCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Watermark lag</div>
        <div className="kpi-value flex items-baseline gap-1">
          <span>{lag.value}</span>
          {lag.unit ? (
            <span className="text-[12px] text-fg-muted font-normal">
              {lag.unit}
            </span>
          ) : null}
        </div>
        <div className="kpi-sub">
          {watermarkLagMs === null
            ? "no watermark signal"
            : "worst across sources"}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Active reactors</div>
        <div className="kpi-value">{taskManagerCount}</div>
        <div className="kpi-sub">
          {slotsUsed}/{slotsTotal} slots · {slotPct}% util
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Job health</div>
        <div className="kpi-value text-fr-sage">
          {jobsRunning}
          <span className="text-[14px] text-fg-muted">
            {" "}
            / {jobsRunning + jobsFailed}
          </span>
        </div>
        <div className="kpi-sub">
          {jobsFailed} failed · {jobsFinished} finished
        </div>
      </div>
    </div>
  )
}
