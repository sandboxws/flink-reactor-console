import type { BlueGreenState } from "@flink-reactor/ui"
import { getStateBadgeColor, getStateLabel } from "@/data/bg-deployment-types"
import { cn } from "@/lib/cn"

const colorClasses: Record<string, string> = {
  green: "bg-status-active/15 text-status-active border-status-active/30",
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
        className={cn(
          "size-1.5 rounded-full",
          color === "green" && "bg-status-active animate-pulse",
          color === "amber" && "bg-amber-400 animate-pulse",
          color === "blue" && "bg-sky-400 animate-pulse",
          color === "gray" && "bg-zinc-400",
        )}
      />
      {getStateLabel(state)}
    </span>
  )
}
