/**
 * Simulation timeline — uses the deployment timeline pattern (state-pill
 * lifecycle + observation log). Walks through PENDING → RUNNING →
 * (COMPLETED | FAILED | CANCELLED), highlighting the current step.
 */

import { format } from "date-fns"
import type { SimulationRun, SimulationStatus } from "@/lib/graphql-api-client"

interface SimulationTimelineProps {
  run: SimulationRun
}

const STEPS_NORMAL = [
  { key: "PENDING", label: "Queued" },
  { key: "RUNNING", label: "Running" },
  { key: "COMPLETED", label: "Completed" },
] as const

const STEPS_FAIL = [
  { key: "PENDING", label: "Queued" },
  { key: "RUNNING", label: "Running" },
  { key: "FAILED", label: "Failed" },
] as const

const STEPS_CANCEL = [
  { key: "PENDING", label: "Queued" },
  { key: "RUNNING", label: "Running" },
  { key: "CANCELLED", label: "Cancelled" },
] as const

function pickSteps(status: SimulationStatus) {
  if (status === "FAILED") return STEPS_FAIL
  if (status === "CANCELLED") return STEPS_CANCEL
  return STEPS_NORMAL
}

function currentIdx(
  status: SimulationStatus,
  steps: readonly { key: string }[],
) {
  return steps.findIndex((s) => s.key === status)
}

export function SimulationTimeline({ run }: SimulationTimelineProps) {
  const steps = pickSteps(run.status)
  const idx = currentIdx(run.status, steps)
  const observations = run.observations ?? []
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => {
          const status =
            i < idx
              ? "done"
              : i === idx
                ? run.status === "FAILED" || run.status === "CANCELLED"
                  ? "failed"
                  : "active"
                : "pending"
          return (
            <span
              key={s.key}
              className={`state-pill ${status}`}
              aria-current={status === "active" ? "step" : undefined}
            >
              {s.label}
            </span>
          )
        })}
      </div>

      {observations.length === 0 ? (
        <p className="text-[12px] font-mono text-fg-faint">
          No observations recorded yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {observations.map((o, i) => (
            <li
              key={`${o.timestamp}-${i}`}
              className="activity-entry grid grid-cols-[110px,150px,1fr,90px] items-baseline gap-3 text-[11.5px]"
            >
              <span className="font-mono text-fg-faint">
                {format(new Date(o.timestamp), "HH:mm:ss.SSS")}
              </span>
              <span className="font-mono text-fr-coral">{o.metric}</span>
              <span className="font-mono text-fg truncate">
                {o.annotation ?? "—"}
              </span>
              <span className="text-right font-mono text-zinc-100">
                {o.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
