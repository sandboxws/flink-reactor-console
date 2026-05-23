/**
 * Hub Data Skew tab — per-vertex subtask distribution as a horizontal heatmap
 * row. Intensity per cell normalizes the subtask's records value (in or out)
 * against that vertex's max, so each row encodes its own skew story.
 *
 * Wide-parallelism rows truncate to {@link MAX_VISIBLE_CELLS} cells with a
 * "+N more" affordance that expands inline.
 */

import type { FlinkJob, SubtaskMetrics } from "@flink-reactor/ui"
import { HeatmapCell, type HeatmapIntensity } from "@flink-reactor/ui"
import { BarChart3 } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"

const MAX_VISIBLE_CELLS = 64
const CELL_SIZE = 14
const CELL_GAP = 3

type MetricKey = "recordsIn" | "recordsOut"

/** Maps a subtask value to a 0..4 intensity bucket scaled against the vertex max. */
function intensityFor(value: number, max: number): HeatmapIntensity {
  if (max <= 0 || value <= 0) return 0
  const ratio = value / max
  if (ratio >= 0.85) return 4
  if (ratio >= 0.65) return 3
  if (ratio >= 0.4) return 2
  if (ratio >= 0.15) return 1
  return 0
}

function formatSI(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Stats summary per vertex row — surfaced beside the heatmap row. */
function vertexStats(values: number[]) {
  if (values.length === 0) return { max: 0, min: 0, skew: 0 }
  const max = Math.max(...values)
  const min = Math.min(...values.filter((v) => v > 0), max)
  const skew = min > 0 ? max / min : 0
  return { max, min, skew }
}

function VertexRow({
  name,
  parallelism,
  subtasks,
  metric,
}: {
  name: string
  parallelism: number
  subtasks: SubtaskMetrics[]
  metric: MetricKey
}) {
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(
    () => [...subtasks].sort((a, b) => a.subtaskIndex - b.subtaskIndex),
    [subtasks],
  )
  const values = sorted.map((s) => s[metric])
  const stats = vertexStats(values)
  const hidden = Math.max(0, sorted.length - MAX_VISIBLE_CELLS)
  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE_CELLS)

  return (
    <div className="glass-card-static flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-sans text-[13px] font-medium text-zinc-100 truncate">
            {name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span>×{parallelism}</span>
            <span className="text-fg-faint">·</span>
            <span>max {formatSI(stats.max)}</span>
            {stats.skew > 0 ? (
              <>
                <span className="text-fg-faint">·</span>
                <span className={cn(stats.skew > 2 ? "text-fr-rose" : "")}>
                  {stats.skew.toFixed(1)}× skew
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="font-mono text-[11px] text-fg-faint py-2">
          No subtask metrics yet
        </div>
      ) : (
        <div
          className="flex flex-wrap"
          style={{ gap: CELL_GAP }}
          role="img"
          aria-label={`Subtask distribution for ${name}`}
        >
          {visible.map((s) => (
            <HeatmapCell
              key={s.subtaskIndex}
              intensity={intensityFor(s[metric], stats.max)}
              size={CELL_SIZE}
              title={`Subtask ${s.subtaskIndex}: ${formatSI(s[metric])} records`}
            />
          ))}
          {!expanded && hidden > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-sm bg-dash-panel border border-dash-border px-2 text-[10px] font-mono text-fg-muted hover:text-zinc-100 hover:border-fr-coral transition-colors"
              style={{ height: CELL_SIZE }}
            >
              +{hidden} more
            </button>
          ) : null}
          {expanded && hidden > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-sm bg-dash-panel border border-dash-border px-2 text-[10px] font-mono text-fg-muted hover:text-zinc-100 transition-colors"
              style={{ height: CELL_SIZE }}
            >
              collapse
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function HubDataSkewTab({ job }: { job: FlinkJob }) {
  const [metric, setMetric] = useState<MetricKey>("recordsIn")
  const vertices = job.plan?.vertices ?? []

  if (vertices.length === 0) {
    return (
      <div className="glass-card-static flex flex-col items-center justify-center gap-2 py-16">
        <BarChart3 className="size-7 text-fg-faint" />
        <p className="text-[13px] text-fg-muted">No vertex data available</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-fg-muted">
          One row per vertex · intensity normalized to that vertex's max ·
          {MAX_VISIBLE_CELLS} cells shown by default
        </p>
        <div className="inline-flex rounded-md border border-dash-border p-0.5">
          <button
            type="button"
            onClick={() => setMetric("recordsIn")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              metric === "recordsIn"
                ? "bg-dash-elevated text-zinc-100"
                : "text-fg-muted hover:text-zinc-200",
            )}
          >
            Records In
          </button>
          <button
            type="button"
            onClick={() => setMetric("recordsOut")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              metric === "recordsOut"
                ? "bg-dash-elevated text-zinc-100"
                : "text-fg-muted hover:text-zinc-200",
            )}
          >
            Records Out
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {vertices.map((v) => (
          <VertexRow
            key={v.id}
            name={v.name}
            parallelism={v.parallelism}
            subtasks={job.subtaskMetrics[v.id] ?? []}
            metric={metric}
          />
        ))}
      </div>
    </div>
  )
}
