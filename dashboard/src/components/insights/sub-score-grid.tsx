/**
 * @module sub-score-grid
 * Responsive grid of health sub-category score cards. Each card maps a
 * {@link HealthSubScore} to a domain-specific icon and severity-colored accent,
 * providing at-a-glance visibility into individual health dimensions.
 */
import {
  Activity,
  AlertTriangle,
  Layers,
  MemoryStick,
  Shield,
} from "lucide-react"
import { MetricCard } from "@flink-reactor/ui"
import type { HealthSubScore } from "@/stores/insights-store"

/** Maps sub-score category names to their corresponding Lucide icon components. */
const SUB_SCORE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "Slot Utilization": Layers,
  Backpressure: Activity,
  "Checkpoint Health": Shield,
  "Memory Pressure": MemoryStick,
  "Exception Rate": AlertTriangle,
}

/** Maps health status strings to accent color classes for MetricCard. */
const STATUS_ACCENTS: Record<string, string> = {
  healthy: "text-job-running",
  warning: "text-fr-amber",
  critical: "text-job-failed",
}

/**
 * Renders a 5-column responsive grid of {@link MetricCard} components, one per
 * health sub-category. Each card shows the category icon, name, numeric score,
 * severity-colored accent, and a detail description.
 */
export function SubScoreGrid({ subScores }: { subScores: HealthSubScore[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {subScores.map((sub) => {
        const Icon = SUB_SCORE_ICONS[sub.name] ?? Activity
        const accent = STATUS_ACCENTS[sub.status] ?? "text-zinc-500"

        return (
          <MetricCard
            key={sub.name}
            icon={Icon}
            label={sub.name}
            value={sub.score}
            accent={accent}
          >
            <p className="mt-1 text-xs text-zinc-500">{sub.detail}</p>
          </MetricCard>
        )
      })}
    </div>
  )
}
