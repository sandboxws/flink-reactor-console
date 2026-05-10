/**
 * Checkpoint density heatmap — wraps `<HeatmapCalendar>` with the legend
 * row above and the live/demo footer below. Live data comes from
 * `useCheckpointDensity`; demo seeded data fills in until storage has
 * checkpoint history.
 */

import { HeatmapCalendar, type HeatmapIntensity } from "@flink-reactor/ui"

interface CheckpointHeatmapProps {
  data: HeatmapIntensity[]
  weeks?: number
  isDemo: boolean
  errorMessage?: string | null
}

export function CheckpointHeatmap({
  data,
  weeks = 26,
  isDemo,
  errorMessage,
}: CheckpointHeatmapProps) {
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
        <HeatmapCalendar data={data} weeks={weeks} fill />
        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
          <span>{weeks} weeks ago</span>
          <span>
            {isDemo ? (
              <span
                title={
                  errorMessage
                    ? `checkpointHistory failed: ${errorMessage}`
                    : "no checkpoint history in storage yet"
                }
              >
                demo · awaiting <code>checkpointHistory</code> data
              </span>
            ) : (
              <span>live · refreshes every 5m</span>
            )}
          </span>
          <span>now</span>
        </div>
      </div>
    </section>
  )
}
