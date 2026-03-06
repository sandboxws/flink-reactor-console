"use client"

import {
  type BlueGreenState,
  getStateBadgeColor,
  getStateLabel,
} from "@/data/bg-deployment-types"
import { cn } from "@/lib/cn"

const colorClasses: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  gray: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

interface StateBadgeProps {
  state: BlueGreenState
  className?: string
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const color = getStateBadgeColor(state)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        colorClasses[color],
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", {
          "bg-emerald-400 animate-pulse": color === "green",
          "bg-amber-400 animate-pulse": color === "amber",
          "bg-sky-400 animate-pulse": color === "blue",
          "bg-zinc-400": color === "gray",
        })}
      />
      {getStateLabel(state)}
    </span>
  )
}
