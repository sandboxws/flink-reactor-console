/**
 * Health bars hero — number + horizontal bar per health dimension.
 *
 * Renders one bar per `HealthRing` value. Used for cluster overall
 * health, pipeline health, resource pressure, and instrument health on the
 * insights/health page. Bar color follows threshold (sage/amber/rose).
 */

interface HealthRing {
  label: string
  value: number
  sub?: string
}

interface HealthRingsProps {
  rings: HealthRing[]
}

function ringColor(value: number): string {
  if (value >= 90) return "var(--color-fr-sage)"
  if (value >= 70) return "var(--color-fr-amber)"
  return "var(--color-fr-rose)"
}

export function HealthRings({ rings }: HealthRingsProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {rings.map((r) => {
        const clamped = Math.max(0, Math.min(100, r.value))
        const color = ringColor(clamped)
        return (
          <div
            key={r.label}
            className="kpi-card"
            role="img"
            aria-label={`${r.label} health: ${Math.round(clamped)}%`}
          >
            <div className="kpi-label">{r.label}</div>
            <div className="kpi-value flex items-baseline gap-1">
              <span style={{ color }}>{Math.round(clamped)}</span>
              <span className="text-[12px] text-fg-muted font-normal">%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-dash-border overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${clamped}%`, backgroundColor: color }}
              />
            </div>
            {r.sub ? (
              <div className="kpi-sub mt-1.5">{r.sub}</div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
