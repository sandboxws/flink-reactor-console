/** Deployment state-machine pill: done, active, pending, failed. */
"use client"

import { cn } from "../../lib/cn"

type StatePillState = "done" | "active" | "pending" | "failed"

interface StatePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: StatePillState
}

/** Rounded monospace pill for state-machine indicators on deployment timelines. */
function StatePill({ state, className, children, ...props }: StatePillProps) {
  return (
    <span className={cn("state-pill", state, className)} {...props}>
      {children}
    </span>
  )
}

export type { StatePillProps, StatePillState }
export { StatePill }
