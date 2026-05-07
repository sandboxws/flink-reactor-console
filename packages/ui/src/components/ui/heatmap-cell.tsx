/** Single heatmap cell at one of 5 intensity levels (0..4). */
"use client"

import { cn } from "../../lib/cn"

type HeatmapIntensity = 0 | 1 | 2 | 3 | 4

interface HeatmapCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  intensity: HeatmapIntensity
  /** Pixel size for the square cell. Defaults to 12. */
  size?: number
}

/** Square cell whose background color encodes a 0..4 intensity scale. */
function HeatmapCell({
  intensity,
  size = 12,
  className,
  style,
  ...props
}: HeatmapCellProps) {
  return (
    <span
      className={cn(`hm-${intensity}`, "rounded-sm inline-block", className)}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}

export type { HeatmapCellProps, HeatmapIntensity }
export { HeatmapCell }
