/**
 * @module plan-state-forecast
 *
 * Renders state growth forecast cards for stateful operators in a Flink
 * execution plan. Each card shows estimated state size at 1h, 24h, and 7d
 * intervals, colored by growth pattern (bounded/linear/unbounded), along
 * with state type and TTL configuration status.
 */

import { formatBytes } from "@flink-reactor/ui"
import { Database } from "lucide-react"
import { cn } from "@/lib/cn"
import type { StateGrowthForecast } from "@/lib/plan-analyzer/types"

/** Growth pattern color and label mapping. */
const GROWTH_STYLES = {
  bounded: { color: "text-job-running", label: "Bounded" },
  linear: { color: "text-fr-amber", label: "Linear" },
  unbounded: { color: "text-job-failed", label: "Unbounded" },
} as const

/**
 * List of state growth forecast cards for stateful operators.
 *
 * Shows estimated sizes at 1h/24h/7d horizons with color-coded growth
 * pattern badges. Unbounded growth is highlighted in red as a warning.
 * Falls back to an empty state when no stateful operators exist.
 */
export function PlanStateForecast({
  forecasts,
}: {
  forecasts: StateGrowthForecast[]
}) {
  if (forecasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <Database className="mb-2 size-5" />
        <span className="text-xs">No stateful operators in this plan</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {forecasts.map((f) => {
        const growth = GROWTH_STYLES[f.growthPattern]
        return (
          <div
            key={f.operatorId}
            className="rounded-lg border border-white/5 bg-dash-elevated p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-200">
                {f.operatorName}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-medium",
                  growth.color,
                  f.growthPattern === "bounded"
                    ? "bg-job-running/15"
                    : f.growthPattern === "linear"
                      ? "bg-fr-amber/15"
                      : "bg-job-failed/15",
                )}
              >
                {growth.label}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[9px] text-zinc-500">1 hour</div>
                <div className="text-xs tabular-nums text-zinc-300">
                  {formatBytes(f.estimatedSize1h)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500">24 hours</div>
                <div
                  className={cn(
                    "text-xs tabular-nums",
                    f.growthPattern === "unbounded"
                      ? "text-job-failed"
                      : "text-zinc-300",
                  )}
                >
                  {formatBytes(f.estimatedSize24h)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500">7 days</div>
                <div
                  className={cn(
                    "text-xs tabular-nums",
                    f.growthPattern === "unbounded"
                      ? "text-job-failed"
                      : "text-zinc-300",
                  )}
                >
                  {formatBytes(f.estimatedSize7d)}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
              <span>
                State: <span className="text-zinc-400">{f.stateType}</span>
              </span>
              <span>
                TTL:{" "}
                <span
                  className={
                    f.ttlConfigured ? "text-job-running" : "text-zinc-400"
                  }
                >
                  {f.ttlConfigured ? "Configured" : "Not set"}
                </span>
              </span>
            </div>

            {f.warning && (
              <div className="mt-1.5 text-[10px] text-fr-amber">
                {f.warning}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
