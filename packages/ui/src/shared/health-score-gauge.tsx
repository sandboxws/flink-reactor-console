/** Circular health score gauge — radial progress indicator for 0-100 scores. */
"use client"

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-job-running)"
  if (score >= 50) return "var(--color-fr-amber)"
  return "var(--color-job-failed)"
}

/** SVG radial gauge that visualizes a 0-100 health score with color-coded thresholds (green/amber/red). */
export function HealthScoreGauge({
  score,
  size = 200,
  strokeWidth = 12,
}: {
  score: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score)) / 100
  const dashOffset = circumference * (1 - progress)
  const color = scoreColor(score)
  const center = size / 2

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
        role="img"
        aria-label={`Health score: ${Math.round(score)} out of 100`}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-dash-border)"
          strokeWidth={strokeWidth}
        />
        {/* Foreground arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
        />
        {/* Score text */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="700"
          className="transition-colors duration-700"
        >
          {Math.round(score)}
        </text>
        <text
          x={center}
          y={center + size * 0.12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-fg-dim)"
          fontSize={size * 0.07}
          fontWeight="500"
          letterSpacing="0.05em"
        >
          HEALTH SCORE
        </text>
      </svg>
    </div>
  )
}
