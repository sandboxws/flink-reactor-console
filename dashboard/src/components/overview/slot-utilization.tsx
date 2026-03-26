/**
 * @module slot-utilization
 *
 * Task slot availability gauge for the cluster overview. Shows available
 * vs total slots with a progress bar that changes color based on
 * availability thresholds (green > 50%, amber >= 10%, red < 10%).
 */

import { Progress } from "@flink-reactor/ui"
import { Layers } from "lucide-react"
import { cn } from "@/lib/cn"

/**
 * Displays task slot availability as a fraction, percentage, and progress bar.
 *
 * The color shifts from green (healthy) to amber (low) to red (critical) as
 * the percentage of free slots decreases, providing an at-a-glance health
 * indicator for cluster capacity.
 */
export function SlotUtilization({
  available,
  total,
}: {
  /** Number of currently unoccupied task slots. */
  available: number
  /** Total number of task slots across all task managers. */
  total: number
}) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0

  // Color gradient based on availability percentage
  const color =
    pct > 50
      ? "text-job-running" // green — healthy
      : pct >= 10
        ? "text-fr-amber" // amber — getting low
        : "text-job-failed" // red — critical

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Layers className={cn("size-4", color)} />
        <span className="text-xs font-medium uppercase tracking-wide">
          Slot Utilization
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-zinc-100">
          {available}
          <span className="text-sm font-normal text-zinc-500"> / {total}</span>
        </span>
        <span className={cn("text-sm font-medium", color)}>{pct}% free</span>
      </div>

      <Progress value={pct} className="mt-3" />
    </div>
  )
}
