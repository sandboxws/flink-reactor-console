/**
 * Vertex × subtask backpressure heatmap.
 *
 * Renders a row-per-vertex heatmap with per-subtask cells. Cell intensity
 * (`.hm-*`) is derived from each subtask's ratio (0..1). When a vertex has
 * no subtask ratios, the cell color reflects the vertex-level label
 * (ok / low / high). Falls back to a friendly empty state when no
 * backpressure data is available yet.
 */

import type { FlinkJob, VertexBackPressure } from "@flink-reactor/ui"

interface BottleneckHeatmapProps {
  job: FlinkJob | null
}

function intensityFromRatio(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio < 0.1) return 0
  if (ratio < 0.3) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

function intensityFromLevel(
  level: VertexBackPressure["level"],
): 0 | 1 | 2 | 3 | 4 {
  if (level === "high") return 4
  if (level === "low") return 2
  return 0
}

export function BottleneckHeatmap({ job }: BottleneckHeatmapProps) {
  const vertices = job?.plan?.vertices ?? []
  if (!job || vertices.length === 0) {
    return (
      <p className="text-[12px] text-fg-muted text-center py-6">
        No vertex backpressure data yet — vertex detail loads after the first
        poll cycle.
      </p>
    )
  }

  const maxParallelism = Math.max(...vertices.map((v) => v.parallelism))

  return (
    <div className="overflow-x-auto">
      <div className="space-y-1 inline-block">
        <div className="flex gap-1 items-center">
          <span className="w-32 shrink-0" />
          <div className="flex gap-1">
            {Array.from({ length: maxParallelism }, (_, i) => (
              <span
                key={i}
                className="w-4 text-[9px] font-mono text-center text-fg-faint"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
        {vertices.map((v) => {
          const bp = job.backpressure[v.id]
          const subtasks = bp?.subtasks ?? []
          const fallbackIntensity = bp ? intensityFromLevel(bp.level) : 0
          const isHotSpot = bp?.level === "high"
          const labelClass = isHotSpot
            ? "text-fr-coral font-bold"
            : "text-fg-muted"
          return (
            <div key={v.id} className="flex gap-1 items-center">
              <span
                className={`w-32 shrink-0 text-[10px] font-mono truncate ${labelClass}`}
                title={v.name}
              >
                {v.name}
                {isHotSpot ? " ⚠" : ""}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: v.parallelism }, (_, i) => {
                  const sub = subtasks[i]
                  const intensity = sub
                    ? intensityFromRatio(sub.ratio)
                    : fallbackIntensity
                  return (
                    <span
                      key={i}
                      className={`hm-${intensity} inline-block size-4 rounded-sm`}
                      title={
                        sub
                          ? `subtask ${i}: ${(sub.ratio * 100).toFixed(0)}% bp`
                          : `subtask ${i}: ${bp?.level ?? "unknown"}`
                      }
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
