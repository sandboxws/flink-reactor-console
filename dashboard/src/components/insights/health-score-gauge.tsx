/** Health score bar — number + horizontal bar with threshold coloring. */

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-job-running)"
  if (score >= 50) return "var(--color-fr-amber)"
  return "var(--color-job-failed)"
}

export function HealthScoreGauge({
  score,
  size: _size,
  strokeWidth: _strokeWidth,
}: {
  score: number
  /** @deprecated No longer used — kept for API compatibility. */
  size?: number
  /** @deprecated No longer used — kept for API compatibility. */
  strokeWidth?: number
}) {
  void _size
  void _strokeWidth
  const clamped = Math.max(0, Math.min(100, score))
  const color = scoreColor(clamped)

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      role="img"
      aria-label={`Health score: ${Math.round(clamped)} out of 100`}
    >
      <span
        className="font-mono text-[28px] font-bold leading-none"
        style={{ color }}
      >
        {Math.round(clamped)}
      </span>
      <div className="h-1.5 w-20 rounded-full bg-dash-border overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-fg-dim">/ 100</span>
    </div>
  )
}
