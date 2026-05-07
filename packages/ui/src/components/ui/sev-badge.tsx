/** Monospace severity pill: OK, WARN, FAIL, INFO, MUTED, CORAL. */
"use client"

import { cn } from "../../lib/cn"

type SevTone = "ok" | "warn" | "fail" | "info" | "muted" | "coral"

interface SevBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: SevTone
}

/** Linear-style monospace severity pill — distinct from the rounded `<Badge>` primitive. */
function SevBadge({ tone, className, children, ...props }: SevBadgeProps) {
  return (
    <span className={cn("sev-badge", tone, className)} {...props}>
      {children}
    </span>
  )
}

export type { SevBadgeProps, SevTone }
export { SevBadge }
