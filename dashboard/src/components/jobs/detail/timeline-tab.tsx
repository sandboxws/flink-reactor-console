import { Clock, Maximize2, ZoomIn, ZoomOut } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import type { JobVertex } from "@/data/cluster-types"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-job-running",
  FINISHED: "bg-job-finished",
  FAILED: "bg-job-failed",
  CANCELED: "bg-job-cancelled",
  CREATED: "bg-job-created",
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function formatTimeOffset(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m${sec > 0 ? ` ${sec}s` : ""}`
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function GanttTooltip({
  vertex,
  jobStartMs,
}: {
  vertex: JobVertex
  jobStartMs: number
}) {
  return (
    <div
      className="rounded-md border border-dash-border px-2.5 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="text-[10px] font-medium text-fg-secondary">{vertex.name}</p>
      <p className="text-[10px] text-fg-muted">
        Start: +{formatTimeOffset(vertex.startTime - jobStartMs)}
      </p>
      <p className="text-[10px] text-fg-muted">
        Duration: {formatDuration(vertex.duration)}
      </p>
      <p className="text-[10px] text-fg-muted">Status: {vertex.status}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimelineTab
// ---------------------------------------------------------------------------

export function TimelineTab({
  vertices,
  jobStartTime,
}: {
  vertices: JobVertex[]
  jobStartTime: Date
}) {
  const [zoom, setZoom] = useState(1)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const {
    bars,
    totalDuration,
    maxEndMs: _maxEndMs,
  } = useMemo(() => {
    if (vertices.length === 0)
      return { bars: [], totalDuration: 0, maxEndMs: 0 }

    const jobStartMs = jobStartTime.getTime()
    const endTimes = vertices.map((v) => v.startTime + v.duration)
    const maxEnd = Math.max(...endTimes)
    const total = maxEnd - jobStartMs

    const sorted = [...vertices].sort((a, b) => a.startTime - b.startTime)

    return {
      bars: sorted.map((v) => ({
        vertex: v,
        offsetPct: total > 0 ? ((v.startTime - jobStartMs) / total) * 100 : 0,
        widthPct: total > 0 ? (v.duration / total) * 100 : 100,
      })),
      totalDuration: total,
      maxEndMs: maxEnd,
    }
  }, [vertices, jobStartTime])

  if (vertices.length === 0) {
    return <EmptyState icon={Clock} message="No timeline data available" />
  }

  const jobStartMs = jobStartTime.getTime()

  // Generate time axis ticks
  const tickCount = Math.min(8, Math.max(4, Math.floor(6 * zoom)))
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => ({
    label: formatTimeOffset((totalDuration / tickCount) * i),
    pct: (i / tickCount) * 100,
  }))

  return (
    <div className="flex flex-col gap-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z * 1.5, 4))}
          className="flex items-center gap-1 rounded-md border border-dash-border px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ZoomIn className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z / 1.5, 0.5))}
          className="flex items-center gap-1 rounded-md border border-dash-border px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ZoomOut className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="flex items-center gap-1 rounded-md border border-dash-border px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <Maximize2 className="size-3" />
          Fit
        </button>
      </div>

      {/* Gantt chart */}
      <div className="glass-card overflow-x-auto p-4">
        <div style={{ minWidth: `${100 * zoom}%` }}>
          {/* Time axis */}
          <div className="relative mb-3 h-4 border-b border-dash-border">
            {ticks.map((tick) => (
              <span
                key={tick.pct}
                className="absolute -translate-x-1/2 text-[9px] tabular-nums text-zinc-600"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          {/* Bars */}
          <div className="flex flex-col gap-2">
            {bars.map((bar, i) => (
              <div
                key={bar.vertex.id}
                className="relative flex items-center gap-3"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Vertex name */}
                <div className="w-36 shrink-0 truncate text-right text-[10px] text-zinc-400">
                  {bar.vertex.name}
                </div>

                {/* Bar track */}
                <div className="relative h-6 flex-1 rounded bg-white/[0.02]">
                  <div
                    className={cn(
                      "absolute top-0 h-full rounded transition-opacity",
                      STATUS_COLORS[bar.vertex.status] ?? "bg-job-created",
                      hoveredIdx === i ? "opacity-80" : "opacity-50",
                    )}
                    style={{
                      left: `${bar.offsetPct}%`,
                      width: `${Math.max(bar.widthPct, 0.5)}%`,
                    }}
                  />
                  {/* Duration label on bar */}
                  <span
                    className="absolute top-0.5 text-[9px] font-medium text-white/80"
                    style={{
                      left: `${bar.offsetPct + Math.max(bar.widthPct, 0.5) / 2}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {formatDuration(bar.vertex.duration)}
                  </span>
                </div>

                {/* Tooltip on hover */}
                {hoveredIdx === i && (
                  <div className="absolute left-40 top-full z-10 mt-1">
                    <GanttTooltip vertex={bar.vertex} jobStartMs={jobStartMs} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-[10px]">
            <span className={cn("size-2 rounded-full", color)} />
            <span className="text-zinc-500">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
