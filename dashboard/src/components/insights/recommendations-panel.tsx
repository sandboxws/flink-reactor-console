/**
 * @module recommendations-panel
 * Actionable recommendations panel generated from bottleneck analysis. Each
 * recommendation is categorized by {@link RecommendationType} and displayed
 * with a type-specific icon, message, detail text, and originating job/score.
 */
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Cpu,
  GitFork,
} from "lucide-react"
import type {
  Recommendation,
  RecommendationType,
} from "@/data/bottleneck-analyzer"
import { cn } from "@/lib/cn"

/** Per-recommendation-type icon, color, and background configuration. */
const typeConfig: Record<
  RecommendationType,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    bgColor: string
  }
> = {
  "increase-parallelism": {
    icon: ArrowUpCircle,
    color: "text-job-failed",
    bgColor: "bg-job-failed/10",
  },
  "data-skew": {
    icon: AlertTriangle,
    color: "text-fr-amber",
    bgColor: "bg-fr-amber/10",
  },
  "slow-operator": {
    icon: Cpu,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  "backpressure-cascade": {
    icon: GitFork,
    color: "text-fr-purple",
    bgColor: "bg-fr-purple/10",
  },
}

/**
 * Renders a list of optimization recommendations from the bottleneck analyzer.
 * Each card shows the recommendation type icon, message, detail explanation,
 * and the originating job name with its bottleneck score. Displays a
 * "No bottlenecks detected" empty state when no recommendations exist.
 */
export function RecommendationsPanel({
  recommendations,
}: {
  recommendations: Recommendation[]
}) {
  if (recommendations.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-2 py-12">
        <CheckCircle2 className="size-6 text-job-running" />
        <p className="text-sm font-medium text-zinc-300">
          No bottlenecks detected
        </p>
        <p className="text-xs text-zinc-500">
          All vertices are performing within normal parameters
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card flex flex-col gap-2 p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Recommendations
      </h2>
      <div className="flex flex-col gap-2">
        {recommendations.map((rec, i) => {
          const config = typeConfig[rec.type]
          const Icon = config.icon
          return (
            <div
              key={`${rec.jobId}-${rec.vertexId}-${i}`}
              className="flex gap-3 rounded-lg border border-dash-border bg-dash-surface p-3"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md",
                  config.bgColor,
                )}
              >
                <Icon className={cn("size-4", config.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-200">
                  {rec.message}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">{rec.detail}</p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  {rec.jobName} &middot; Score: {rec.score}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
