/**
 * Checkpoint density heatmap — wraps `<HeatmapCalendar>` with the legend
 * row above and a state-aware footer below.
 *
 * Renders three explicit states from `useCheckpointDensity`:
 *  - `loading`: heatmap dimmed at low opacity, "loading" badge
 *  - `empty`: "No checkpoints in window" overlay
 *  - live: real intensities with refresh-cadence footer
 */

import { HeatmapCalendar, type HeatmapIntensity } from "@flink-reactor/ui"

interface CheckpointHeatmapProps {
  data: HeatmapIntensity[]
  weeks?: number
  loading: boolean
  empty: boolean
  errorMessage?: string | null
}

export function CheckpointHeatmap({
  data,
  weeks = 26,
  loading,
  empty,
  errorMessage,
}: CheckpointHeatmapProps) {
  const showEmptyOverlay = !loading && empty
  const showErrorOverlay = !!errorMessage && !loading

  const footerText = loading
    ? "loading checkpoint history…"
    : showErrorOverlay
      ? `checkpointHistory failed: ${errorMessage}`
      : showEmptyOverlay
        ? "No checkpoints in window"
        : "live · refreshes every 5m"

  // Ensure the calendar always has weeks*7 cells so the grid renders even
  // when we have nothing to show. The overlay covers the visuals in the
  // empty / loading cases.
  const safeData: HeatmapIntensity[] =
    data.length === weeks * 7
      ? data
      : (Array.from({ length: weeks * 7 }, () => 0) as HeatmapIntensity[])

  return (
    <section className="mb-8">
      <div className="glass-card-static p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-sans text-[14px] font-medium text-zinc-100">
              Checkpoint density
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Last {weeks} weeks · all pipelines · darker = more checkpoints
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-fg-faint">
            <span>less</span>
            <span className="hm-0 inline-block size-3 rounded-sm" />
            <span className="hm-1 inline-block size-3 rounded-sm" />
            <span className="hm-2 inline-block size-3 rounded-sm" />
            <span className="hm-3 inline-block size-3 rounded-sm" />
            <span className="hm-4 inline-block size-3 rounded-sm" />
            <span>more</span>
          </div>
        </div>
        <div className="relative">
          <div style={{ opacity: loading || showEmptyOverlay ? 0.25 : 1 }}>
            <HeatmapCalendar data={safeData} weeks={weeks} fill />
          </div>
          {showEmptyOverlay || showErrorOverlay ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-mono text-fg-muted">
                {showErrorOverlay
                  ? "Failed to load checkpoint history"
                  : "No checkpoints in window"}
              </span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
          <span>{weeks} weeks ago</span>
          <span title={errorMessage ?? undefined}>{footerText}</span>
          <span>now</span>
        </div>
      </div>
    </section>
  )
}
