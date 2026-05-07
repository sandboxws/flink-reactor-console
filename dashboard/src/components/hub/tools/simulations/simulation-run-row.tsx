/**
 * Simulation run row — one entry in the runs list. Shows status pill,
 * scenario, throughput sparkline (over time), started-at, and a
 * pass/fail/timeout outcome.
 */

import { Link } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import type { SimulationRun, SimulationStatus } from "@/lib/graphql-api-client"

interface SimulationRunRowProps {
  run: SimulationRun
}

/** Map status → state-pill modifier. */
function statusPill(status: SimulationStatus): string {
  switch (status) {
    case "RUNNING":
      return "active"
    case "COMPLETED":
      return "done"
    case "FAILED":
    case "CANCELLED":
      return "failed"
    case "PENDING":
      return "pending"
  }
}

/** Map status → outcome chip text + color. */
function outcomeBadge(status: SimulationStatus): {
  label: string
  tone: "sage" | "rose" | "amber" | "muted"
} {
  switch (status) {
    case "COMPLETED":
      return { label: "PASS", tone: "sage" }
    case "FAILED":
      return { label: "FAIL", tone: "rose" }
    case "CANCELLED":
      return { label: "STOP", tone: "amber" }
    case "RUNNING":
      return { label: "LIVE", tone: "sage" }
    case "PENDING":
      return { label: "WAIT", tone: "muted" }
  }
}

/** Lightweight throughput sparkline from observation values. */
function ThroughputSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="text-[10px] font-mono text-fg-faint">no data</div>
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(1, max - min)
  return (
    <div className="sparkbar flex h-4 items-end gap-[2px]" aria-hidden>
      {values.map((v, i) => {
        const h = ((v - min) / range) * 100
        return (
          <span
            key={i}
            className="block w-[3px] rounded-sm bg-fr-coral/70"
            style={{ height: `${Math.max(8, h)}%` }}
          />
        )
      })}
    </div>
  )
}

export function SimulationRunRow({ run }: SimulationRunRowProps) {
  const throughputs = (run.observations ?? [])
    .filter((o) => o.metric === "throughput")
    .map((o) => o.value)
  const outcome = outcomeBadge(run.status)
  return (
    <Link
      to="/hub/admin/simulations/$runId"
      params={{ runId: run.id }}
      className="grid grid-cols-[100px,1fr,160px,90px,90px] items-center gap-3 px-3 py-2 text-[12px] hover:bg-dash-elevated/40"
    >
      <span className={`state-pill ${statusPill(run.status)} w-fit`}>
        {run.status.toLowerCase()}
      </span>
      <span className="font-mono text-fg truncate">{run.scenario}</span>
      <ThroughputSparkline values={throughputs} />
      <span className="font-mono text-[10.5px] text-fg-faint">
        {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
      </span>
      <span
        className={
          outcome.tone === "sage"
            ? "sev-badge ok"
            : outcome.tone === "rose"
              ? "sev-badge fail"
              : outcome.tone === "amber"
                ? "sev-badge warn"
                : "sev-badge muted"
        }
      >
        {outcome.label}
      </span>
    </Link>
  )
}
