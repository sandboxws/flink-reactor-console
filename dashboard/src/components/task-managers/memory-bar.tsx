/**
 * @module memory-bar
 *
 * Compact inline progress bar for visualizing memory utilization with
 * color-coded thresholds (green/amber/red) and human-readable byte labels.
 */
import { formatBytes } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// MemoryBar — inline progress bar with used/total labels and color thresholds
// ---------------------------------------------------------------------------

/** Map utilization percentage to a semantic color: green (<60%), amber (60-85%), red (>85%). */
function utilizationColor(pct: number): string {
  if (pct > 85) return "var(--color-job-failed)"
  if (pct >= 60) return "var(--color-log-warn)"
  return "var(--color-job-running)"
}

/**
 * Inline progress bar displaying memory usage as a colored fill and
 * "used / total" byte labels. Fill color transitions from green to amber
 * to red as utilization increases past 60% and 85% thresholds.
 */
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
