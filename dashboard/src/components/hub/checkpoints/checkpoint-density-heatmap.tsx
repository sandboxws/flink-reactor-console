/**
 * Hub-styled wrapper around <HeatmapCalendar> for checkpoint density.
 *
 * Renders the 26-week calendar with the standard "less / more" legend strip
 * and fall-back-to-demo-data behavior driven by `useCheckpointDensity`.
 */

import { HeatmapCalendar, type HeatmapIntensity } from "@flink-reactor/ui"
import { useMemo } from "react"
import { useCheckpointDensity } from "@/lib/hub/use-checkpoint-density"
import { useConfigStore } from "@/stores/config-store"

interface CheckpointDensityHeatmapProps {
  weeks?: number
}

export function CheckpointDensityHeatmap({
  weeks = 26,
}: CheckpointDensityHeatmapProps) {
  const config = useConfigStore((s) => s.config)
  const clusterID = config?.clusters?.[0] ?? null
  const live = useCheckpointDensity(clusterID, { days: weeks * 7 })

  const demo = useMemo<HeatmapIntensity[]>(() => {
    const seeded = (n: number) => {
      const x = Math.sin(n * 13.7) * 10000
      return x - Math.floor(x)
    }
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const r = seeded(i + 1)
      if (r < 0.25) return 0
      if (r < 0.5) return 1
      if (r < 0.72) return 2
      if (r < 0.9) return 3
      return 4
    }) as HeatmapIntensity[]
  }, [weeks])

  const useLive =
    !live.loading && !live.empty && !live.error && live.data.length > 0
  const data = useLive ? live.data : demo

  return (
    <>
      <HeatmapCalendar data={data} weeks={weeks} fill />
      <div className="mt-5 flex items-center gap-2 border-t border-dash-border/40 pt-3 text-[10px] font-mono text-fg-faint">
        <span>less</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <span className="hm-0 inline-block size-3 rounded-sm" />
          <span className="hm-1 inline-block size-3 rounded-sm" />
          <span className="hm-2 inline-block size-3 rounded-sm" />
          <span className="hm-3 inline-block size-3 rounded-sm" />
          <span className="hm-4 inline-block size-3 rounded-sm" />
        </span>
        <span>more</span>
      </div>
      {useLive ? null : (
        <p className="mt-2 text-[10px] font-mono text-fg-faint">
          demo data — awaiting <code>checkpointHistory</code>
        </p>
      )}
    </>
  )
}
