/** Inline badge component with variant-driven colors for labeling and status indicators. */
"use client"

import { cn } from "../../lib/cn"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"
type BadgeTone = "emerald" | "blue" | "purple" | "amber" | "rose"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
  tone?: BadgeTone
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-transparent bg-white/10 text-zinc-200",
  secondary: "border-transparent bg-white/5 text-zinc-400",
  destructive: "border-transparent bg-red-500/15 text-red-400",
  outline: "border-dash-border text-zinc-300",
}

const toneStyles: Record<BadgeTone, string> = {
  emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  blue: "bg-blue-500/20 text-blue-600 dark:text-blue-300",
  purple: "bg-purple-500/20 text-purple-600 dark:text-purple-300",
  amber: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
  rose: "bg-rose-500/20 text-rose-600 dark:text-rose-300",
}

/** Pill-shaped label with default, secondary, destructive, and outline variants. Tone overrides bg/text for semantic coloring. */
function Badge({
  className,
  variant = "default",
  tone,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        tone && toneStyles[tone],
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeProps, BadgeTone, BadgeVariant }
