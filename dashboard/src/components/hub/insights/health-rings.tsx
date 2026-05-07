/**
 * Health rings hero — concentric SVG rings with a centered percentage label.
 *
 * Renders a single ring per `HealthRing` value. Used for cluster overall
 * health, pipeline health, resource pressure, and instrument health on the
 * insights/health page. Each ring color is selected via threshold (sage /
 * amber / rose) so the viewer can scan health at a glance.
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
        const dash = (r.value / 100) * 264 // circumference for r=42
        const color = ringColor(r.value)
        return (
          <div key={r.label} className="kpi-card flex items-center gap-4">
            <div className="health-ring">
              <svg viewBox="0 0 100 100" aria-label={`${r.label} ${r.value}%`}>
                <title>{`${r.label} health: ${r.value}%`}</title>
                <circle
                  className="ring-bg"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  strokeWidth="8"
                  fill="none"
                  stroke={color}
                  strokeDasharray={`${dash} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="ring-label">{Math.round(r.value)}%</div>
            </div>
            <div>
              <div className="kpi-label">{r.label}</div>
              {r.sub ? (
                <div className="text-[12px] text-fg-muted">{r.sub}</div>
              ) : null}
            </div>
          </div>
        )
      })}
    </section>
  )
}
