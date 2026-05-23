/**
 * Hub Watermarks tab — replaces the per-route stub with a per-vertex,
 * per-subtask watermark grid.
 *
 * Each subtask cell encodes lag = (now - watermark) on a 5-bucket intensity
 * ramp; subtasks lagging beyond {@link WARN_LAG_MS} are tinted amber (WARN)
 * and beyond {@link FAIL_LAG_MS} are tinted coral (FAIL).
 *
 * Flink emits `-Infinity` (sometimes encoded as `0` or a tiny epoch) for
 * sources that don't propagate watermarks. Those are shown as muted cells
 * with an "—" hover, so absent-by-design is distinguishable from "stale".
 */

import type { FlinkJob, VertexWatermark } from "@flink-reactor/ui"
import { HeatmapCell, type HeatmapIntensity } from "@flink-reactor/ui"
import { Droplets } from "lucide-react"
import { useMemo } from "react"
import { cn } from "@/lib/cn"

/** Lag at which a subtask is tagged WARN (amber). Tuned for low-latency streaming defaults. */
const WARN_LAG_MS = 60_000
/** Lag at which a subtask is tagged FAIL (coral). */
const FAIL_LAG_MS = 5 * 60_000

const CELL_SIZE = 14
const CELL_GAP = 3
const MAX_VISIBLE_CELLS = 64

function isValidWatermark(w: number): boolean {
  return Number.isFinite(w) && w > 0
}

function lagMs(watermark: number, now: number): number | null {
  if (!isValidWatermark(watermark)) return null
  return Math.max(0, now - watermark)
}

/** Maps watermark lag in ms to a 0..4 intensity. Unset → 0; over FAIL → 4. */
function lagToIntensity(lag: number | null): HeatmapIntensity {
  if (lag === null) return 0
  if (lag >= FAIL_LAG_MS) return 4
  if (lag >= WARN_LAG_MS) return 3
  if (lag >= 30_000) return 2
  if (lag >= 5_000) return 1
  return 1
}

function formatLag(lag: number | null): string {
  if (lag === null) return "—"
  if (lag < 1_000) return `${lag}ms`
  if (lag < 60_000) return `${(lag / 1_000).toFixed(1)}s`
  if (lag < 3_600_000) return `${(lag / 60_000).toFixed(1)}m`
  return `${(lag / 3_600_000).toFixed(1)}h`
}

function VertexWatermarkRow({
  name,
  parallelism,
  watermarks,
  now,
}: {
  name: string
  parallelism: number
  watermarks: VertexWatermark[]
  now: number
}) {
  const sorted = useMemo(
    () => [...watermarks].sort((a, b) => a.subtaskIndex - b.subtaskIndex),
    [watermarks],
  )

  const lags = sorted.map((w) => lagMs(w.watermark, now))
  const validLags = lags.filter((l): l is number => l !== null)
  const maxLag = validLags.length > 0 ? Math.max(...validLags) : null
  const warnCount = validLags.filter((l) => l >= WARN_LAG_MS).length
  const visible = sorted.slice(0, MAX_VISIBLE_CELLS)
  const hidden = Math.max(0, sorted.length - MAX_VISIBLE_CELLS)

  return (
    <div className="glass-card-static flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-sans text-[13px] font-medium text-zinc-100 truncate">
            {name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span>×{parallelism}</span>
            {maxLag !== null ? (
              <>
                <span className="text-fg-faint">·</span>
                <span
                  className={cn(
                    maxLag >= FAIL_LAG_MS
                      ? "text-fr-rose"
                      : maxLag >= WARN_LAG_MS
                        ? "text-fr-amber"
                        : "",
                  )}
                >
                  max lag {formatLag(maxLag)}
                </span>
              </>
            ) : (
              <>
                <span className="text-fg-faint">·</span>
                <span>no watermark</span>
              </>
            )}
            {warnCount > 0 ? (
              <>
                <span className="text-fg-faint">·</span>
                <span className="text-fr-amber">{warnCount} lagging</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="font-mono text-[11px] text-fg-faint py-2">
          No subtask watermarks reported
        </div>
      ) : (
        <div
          className="flex flex-wrap"
          style={{ gap: CELL_GAP }}
          role="img"
          aria-label={`Subtask watermark lags for ${name}`}
        >
          {visible.map((w) => {
            const lag = lagMs(w.watermark, now)
            return (
              <HeatmapCell
                key={w.subtaskIndex}
                intensity={lagToIntensity(lag)}
                size={CELL_SIZE}
                title={`Subtask ${w.subtaskIndex} · lag ${formatLag(lag)}`}
              />
            )
          })}
          {hidden > 0 ? (
            <span
              className="rounded-sm bg-dash-panel border border-dash-border px-2 text-[10px] font-mono text-fg-muted"
              style={{ height: CELL_SIZE, lineHeight: `${CELL_SIZE}px` }}
            >
              +{hidden} more
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

function LegendCell({
  intensity,
  label,
}: {
  intensity: HeatmapIntensity
  label: string
}) {
  return (
    <span className="flex items-center gap-1.5">
      <HeatmapCell intensity={intensity} size={10} />
      <span>{label}</span>
    </span>
  )
}

export function HubWatermarksTab({ job }: { job: FlinkJob }) {
  const now = Date.now()
  const vertices = job.plan?.vertices ?? []

  if (vertices.length === 0) {
    return (
      <div className="glass-card-static flex flex-col items-center justify-center gap-2 py-16">
        <Droplets className="size-7 text-fg-faint" />
        <p className="text-[13px] text-fg-muted">No vertex data available</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-fg-muted">
          One row per vertex · cell intensity encodes lag (now − subtask
          watermark)
        </p>
        <div className="flex items-center gap-3 font-mono text-[10px] text-fg-muted">
          <LegendCell intensity={0} label="no wm" />
          <LegendCell intensity={1} label="fresh" />
          <LegendCell intensity={2} label="30s+" />
          <LegendCell intensity={3} label="1m+ warn" />
          <LegendCell intensity={4} label="5m+ fail" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {vertices.map((v) => (
          <VertexWatermarkRow
            key={v.id}
            name={v.name}
            parallelism={v.parallelism}
            watermarks={job.watermarks[v.id] ?? []}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}
