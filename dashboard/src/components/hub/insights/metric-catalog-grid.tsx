/**
 * Metric catalog grid — lists available metrics as buttons with sparkline
 * thumbnails. Clicking a tile selects the metric for the main canvas.
 *
 * The catalog content is a fixed selection of Flink metric IDs the dashboard
 * already knows about (alerts-store METRIC_DEFINITIONS). When an integrated
 * metric subscription lands, this grid will derive from the live catalog.
 */

import { LineChart } from "lucide-react"

export interface MetricCatalogEntry {
  id: string
  label: string
  group: string
  /** Pre-shaped sparkline points for the thumbnail (raw values 0..1). */
  spark: number[]
}

interface MetricCatalogGridProps {
  entries: MetricCatalogEntry[]
  selectedId: string
  onSelect: (id: string) => void
}

export function MetricCatalogGrid({
  entries,
  selectedId,
  onSelect,
}: MetricCatalogGridProps) {
  return (
    <div className="space-y-0.5 text-[12px]">
      {entries.map((m) => {
        const active = m.id === selectedId
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`file-tree-row w-full text-left ${active ? "active" : ""}`}
          >
            <LineChart
              className={
                active ? "text-fr-coral size-3.5" : "text-fg-faint size-3.5"
              }
            />
            <span
              className={`font-mono truncate ${active ? "text-fr-coral" : "text-fg"}`}
            >
              {m.label}
            </span>
            <span className="ml-auto inline-block">
              <Sparkline points={m.spark} active={active} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Sparkline({ points, active }: { points: number[]; active: boolean }) {
  if (points.length < 2) return null
  const width = 60
  const height = 18
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const dx = width / (points.length - 1)
  const path = points
    .map((v, i) => `${i * dx},${height - ((v - min) / range) * height}`)
    .join(" ")
  const stroke = active ? "var(--color-fr-coral)" : "var(--color-fr-sage)"
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="metric sparkline"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        points={path}
        opacity={active ? 0.95 : 0.55}
      />
    </svg>
  )
}
