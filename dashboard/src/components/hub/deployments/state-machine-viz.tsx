/**
 * Pill-based state-machine visualisation for blue-green deployments.
 *
 * Renders the canonical lifecycle (Pending → Validating → Rolling out →
 * Live) using `.state-pill` modifiers — `done` for completed steps, `active`
 * for the current step, plain for upcoming steps. The Rolling-back step is
 * conditionally inserted only when the deployment is in an abort flow.
 */

import type { BlueGreenState } from "@/data/bg-deployment-types"
import { deploymentColumn } from "./deployment-card"

interface StateMachineVizProps {
  state: BlueGreenState
  abortTimestamp: string | null
}

const STEPS_NORMAL: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "validating", label: "Validating" },
  { key: "rolling-out", label: "Rolling out" },
  { key: "complete", label: "Live" },
]

const STEPS_ABORT: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "validating", label: "Validating" },
  { key: "rolling-out", label: "Rolling out" },
  { key: "rolling-back", label: "Rolling back" },
  { key: "complete", label: "Reverted" },
]

export function StateMachineViz({
  state,
  abortTimestamp,
}: StateMachineVizProps) {
  const aborting = abortTimestamp !== null
  const steps = aborting ? STEPS_ABORT : STEPS_NORMAL
  const current = aborting ? "rolling-back" : deploymentColumn(state)
  const currentIdx = steps.findIndex((s) => s.key === current)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => {
        const status =
          i < currentIdx ? "done" : i === currentIdx ? "active" : "pending"
        return (
          <span
            key={step.key}
            className={`state-pill ${status}`}
            aria-current={status === "active" ? "step" : undefined}
          >
            {step.label}
          </span>
        )
      })}
    </div>
  )
}
