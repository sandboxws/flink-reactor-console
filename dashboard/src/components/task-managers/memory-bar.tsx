import { formatBytes } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// MemoryBar — inline progress bar with used/total labels and color thresholds
// ---------------------------------------------------------------------------

function utilizationColor(pct: number): string {
  if (pct > 85) return "var(--color-job-failed)"
  if (pct >= 60) return "var(--color-log-warn)"
  return "var(--color-job-running)"
}

export function MemoryBar({
  used,
  total,
  className,
}: {
  used: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? (used / total) * 100 : 0
  const color = utilizationColor(pct)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-zinc-500">
        {formatBytes(used)} / {formatBytes(total)}
      </span>
    </div>
  )
}
