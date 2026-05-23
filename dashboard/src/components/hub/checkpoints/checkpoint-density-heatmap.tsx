/**
 * Hub-styled wrapper around <HeatmapCalendar> for checkpoint density.
 *
 * Renders three explicit states from `useCheckpointDensity`:
 *  - `loading`: heatmap dimmed at low opacity, "loading" footer
 *  - `empty`: "No checkpoints in window" overlay
 *  - live: real intensities with a "live" footer
 *
 * No seeded fallback — the surface tells the truth about backing data.
 */

import { HeatmapCalendar, type HeatmapIntensity } from "@flink-reactor/ui"
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

  const showEmptyOverlay = !live.loading && (live.empty || live.error !== null)
  const showErrorOverlay = !!live.error && !live.loading

  const footerText = live.loading
    ? "loading checkpoint history…"
    : showErrorOverlay
      ? `checkpointHistory failed: ${live.error}`
      : showEmptyOverlay
        ? "no checkpoints in window"
        : "live"

  // Pad to a full grid so the calendar always renders cells under the overlay.
  const safeData: HeatmapIntensity[] =
    live.data.length === weeks * 7
      ? live.data
      : (Array.from({ length: weeks * 7 }, () => 0) as HeatmapIntensity[])

  return (
    <>
      <div className="relative">
        <div
          style={{
            opacity: live.loading || showEmptyOverlay ? 0.25 : 1,
          }}
        >
          <HeatmapCalendar data={safeData} weeks={weeks} fill />
        </div>
        {showEmptyOverlay ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-mono text-fg-muted">
              {showErrorOverlay
                ? "Failed to load checkpoint history"
                : "No checkpoints in window"}
            </span>
          </div>
        ) : null}
      </div>
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
      <p
        className="mt-2 text-[10px] font-mono text-fg-faint"
        title={live.error ?? undefined}
      >
        {footerText}
      </p>
    </>
  )
}
