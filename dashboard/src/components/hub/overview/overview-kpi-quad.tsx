/**
 * Overview KPI quad — the 2×2 metric card grid above the engine-bars chart.
 *
 * Throughput / Watermark lag / Active reactors / Job health. Two of the four
 * are placeholder ("—") until `metricSeries` ships per-cluster aggregates.
 * Active-reactors and Job-health are real, computed in the parent.
 */

import { LiveDot } from "@flink-reactor/ui"

interface OverviewKpiQuadProps {
  /** Number of running pipelines, used for the throughput live-dot caption. */
  runningJobsCount: number
  /** Active task slots = total − available. */
  slotsUsed: number
  slotsTotal: number
  slotPct: number
  taskManagerCount: number
  jobsRunning: number
  jobsFinished: number
  jobsFailed: number
}

export function OverviewKpiQuad({
  runningJobsCount,
  slotsUsed,
  slotsTotal,
  slotPct,
  taskManagerCount,
  jobsRunning,
  jobsFinished,
  jobsFailed,
}: OverviewKpiQuadProps) {
  return (
    <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-5">
      <div className="kpi-card">
        <div className="kpi-label">Throughput</div>
        <div className="kpi-value flex items-baseline gap-1">
          <span>—</span>
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
        <div className="kpi-value">—</div>
        <div className="kpi-sub">awaiting metric subscription</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Active reactors</div>
        <div className="kpi-value">{slotsUsed}</div>
        <div className="kpi-sub">
          {taskManagerCount} TMs · {slotsTotal} slots · {slotPct}% util
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
