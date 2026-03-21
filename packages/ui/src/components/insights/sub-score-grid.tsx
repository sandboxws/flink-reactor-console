"use client"

import {
  Activity,
  AlertTriangle,
  Layers,
  MemoryStick,
  Shield,
} from "lucide-react"
import { MetricCard } from "../../shared/metric-card"
import type { HealthSubScore } from "../../types"

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

const STATUS_ACCENTS: Record<string, string> = {
  healthy: "text-job-running",
  warning: "text-fr-amber",
  critical: "text-job-failed",
}

export interface SubScoreGridProps {
  subScores: HealthSubScore[]
}

export function SubScoreGrid({ subScores }: SubScoreGridProps) {
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
