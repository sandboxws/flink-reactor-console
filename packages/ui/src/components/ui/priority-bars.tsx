/** Linear-style 3-bar priority indicator for none/low/medium/high/urgent. */
"use client"

import { cn } from "../../lib/cn"

type PriorityLevel = "none" | "low" | "medium" | "high" | "urgent"

interface PriorityBarsProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: PriorityLevel
}

const labels: Record<PriorityLevel, string> = {
  none: "No priority",
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  urgent: "Urgent priority",
}

/** Three stacked bars whose color and fill count encode priority level. */
function PriorityBars({ level, className, ...props }: PriorityBarsProps) {
  return (
    <span
      role="img"
      aria-label={labels[level]}
      className={cn("priority", `priority-${level}`, className)}
      {...props}
    >
      <span />
      <span />
      <span />
    </span>
  )
}

export type { PriorityBarsProps, PriorityLevel }
export { PriorityBars }
