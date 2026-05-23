/** Tufte sparkline — word-sized inline SVG trend chart for KPI cards. */
"use client"

interface SparklineProps {
  points: number[]
  width?: number
  height?: number
  color?: string
  /** Show a subtle gradient fill under the line. */
  fill?: boolean
  className?: string
}

function Sparkline({
  points,
  width = 80,
  height = 32,
  color = "var(--color-fr-sage)",
  fill = true,
  className,
}: SparklineProps) {
  if (points.length < 2) return null

  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const pad = 1
  const usableH = height - pad * 2
  const dx = width / (points.length - 1)

  const coords = points.map(
    (v, i) => `${i * dx},${pad + usableH - ((v - min) / range) * usableH}`,
  )
  const polyline = coords.join(" ")

  const fillId = `spark-fill-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="sparkline"
      className={className}
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${polyline} ${width},${height}`}
            fill={`url(#${fillId})`}
          />
        </>
      ) : null}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        points={polyline}
        opacity={0.85}
      />
    </svg>
  )
}

export type { SparklineProps }
export { Sparkline }
