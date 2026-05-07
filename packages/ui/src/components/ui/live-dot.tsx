/** Pulsing dot indicating live/active state. Tones map to semantic statuses. */
"use client"

import { cn } from "../../lib/cn"

type LiveDotTone = "sage" | "coral" | "amber" | "rose" | "teal"

interface LiveDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: LiveDotTone
}

/** Sage-by-default 7px pulsing dot for "live" / "running" indicators. */
function LiveDot({ tone = "sage", className, ...props }: LiveDotProps) {
  return (
    <span
      className={cn("live-dot", tone !== "sage" && tone, className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export type { LiveDotProps, LiveDotTone }
export { LiveDot }
