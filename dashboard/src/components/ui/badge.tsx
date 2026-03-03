"use client"

import { cn } from "@/lib/cn"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-transparent bg-white/10 text-zinc-200",
  secondary: "border-transparent bg-white/5 text-zinc-400",
  destructive: "border-transparent bg-red-500/15 text-red-400",
  outline: "border-dash-border text-zinc-300",
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeVariant }
