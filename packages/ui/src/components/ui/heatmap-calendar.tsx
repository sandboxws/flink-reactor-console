/** Multi-week column-based heatmap calendar (e.g. checkpoint density over 26 weeks). */
"use client"

import { cn } from "../../lib/cn"
import { HeatmapCell, type HeatmapIntensity } from "./heatmap-cell"

interface HeatmapCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Per-day intensity values in chronological order. Padded or truncated to weeks * 7. */
  data: HeatmapIntensity[]
  /** Number of week columns. Defaults to 26 (~6 months). */
  weeks?: number
  /** Pixel size for each cell square. Ignored when `fill` is true. */
  cellSize?: number
  /** Pixel gap between cells (and columns). */
  cellGap?: number
  /**
   * When true, the heatmap stretches to fill its parent's width: columns
   * become `1fr` each and cells use `aspect-square` so they remain square
   * but grow with the container. Use this inside cards that should not
   * have empty horizontal whitespace.
   */
  fill?: boolean
}

/** Renders weeks columns of 7 day cells. Older data is left, newer is right. */
function HeatmapCalendar({
  data,
  weeks = 26,
  cellSize = 12,
  cellGap = 3,
  fill = false,
  className,
  style,
  ...props
}: HeatmapCalendarProps) {
  const totalDays = weeks * 7
  const padded: HeatmapIntensity[] =
    data.length >= totalDays
      ? data.slice(-totalDays)
      : [
          ...Array.from(
            { length: totalDays - data.length },
            () => 0 as HeatmapIntensity,
          ),
          ...data,
        ]

  const columns: HeatmapIntensity[][] = []
  for (let w = 0; w < weeks; w++) {
    columns.push(padded.slice(w * 7, (w + 1) * 7))
  }

  if (fill) {
    return (
      <div
        className={cn("grid w-full", className)}
        style={{
          gap: cellGap,
          gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
          ...style,
        }}
        {...props}
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            className="grid"
            style={{
              gap: cellGap,
              gridTemplateRows: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {col.map((intensity, di) => (
              <span
                key={di}
                className={cn(`hm-${intensity}`, "rounded-sm aspect-square")}
                aria-hidden="true"
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn("flex", className)}
      style={{ gap: cellGap, ...style }}
      {...props}
    >
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col" style={{ gap: cellGap }}>
          {col.map((intensity, di) => (
            <HeatmapCell key={di} intensity={intensity} size={cellSize} />
          ))}
        </div>
      ))}
    </div>
  )
}

export type { HeatmapCalendarProps }
export { HeatmapCalendar }
