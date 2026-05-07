/** Hub KPI card: monospace label + big value + optional sub-text and live-dot. */
"use client"

import { cn } from "../../lib/cn"
import { LiveDot, type LiveDotTone } from "./live-dot"

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  /** When set, prepends a pulsing dot to the label. */
  liveDot?: LiveDotTone
}

/** Mono-styled metric card used in overview hero, right rails, job KPI strips. */
function KpiCard({
  label,
  value,
  sub,
  liveDot,
  className,
  children,
  ...props
}: KpiCardProps) {
  return (
    <div className={cn("kpi-card", className)} {...props}>
      <div className={cn("kpi-label", liveDot && "flex items-center gap-1.5")}>
        {liveDot ? <LiveDot tone={liveDot} /> : null}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
      {children}
    </div>
  )
}

export type { KpiCardProps }
export { KpiCard }
