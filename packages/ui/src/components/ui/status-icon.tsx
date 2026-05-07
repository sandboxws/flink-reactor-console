/** Linear-style alert state icon: 6 conic-gradient variants for firing through silenced. */
"use client"

import { cn } from "../../lib/cn"

type StatusIconState =
  | "firing"
  | "acknowledged"
  | "in-progress"
  | "resolved"
  | "suppressed"
  | "silenced"

interface StatusIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: StatusIconState
}

const labels: Record<StatusIconState, string> = {
  firing: "Firing",
  acknowledged: "Acknowledged",
  "in-progress": "In progress",
  resolved: "Resolved",
  suppressed: "Suppressed",
  silenced: "Silenced",
}

/** 14px round status indicator with built-in aria-label per state. */
function StatusIcon({ state, className, ...props }: StatusIconProps) {
  return (
    <span
      role="img"
      aria-label={labels[state]}
      className={cn("status-icon", state, className)}
      {...props}
    />
  )
}

export type { StatusIconProps, StatusIconState }
export { StatusIcon }
