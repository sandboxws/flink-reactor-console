"use client"

import { Zap, Lightbulb } from "lucide-react"
import { BottleneckTable } from "../../components/insights/bottleneck-table"
import { EmptyState } from "../../shared/empty-state"
import type { BottleneckScore, Recommendation } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BottleneckSectionProps {
  bottlenecks: BottleneckScore[]
  recommendations: Recommendation[]
  onNodeClick?: (vertexId: string) => void
}

// ---------------------------------------------------------------------------
// Recommendation type icons
// ---------------------------------------------------------------------------

const REC_COLORS: Record<string, string> = {
  "increase-parallelism": "border-l-fr-purple",
  "data-skew": "border-l-fr-amber",
  "slow-operator": "border-l-job-failed",
  "backpressure-cascade": "border-l-fr-coral",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Renders the bottleneck analysis section with scored operator metrics and recommendations. */
export function BottleneckSection({
  bottlenecks,
  recommendations,
  onNodeClick,
}: BottleneckSectionProps) {
  if (bottlenecks.length === 0 && recommendations.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        message="No bottlenecks detected. Cluster is performing well."
      />
    )
  }

  return (
    <section className="space-y-6 p-4">
      {/* Bottleneck table */}
      {bottlenecks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">
            Bottleneck Analysis
          </h2>
          <BottleneckTable scores={bottlenecks} />
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Lightbulb className="size-4 text-fr-amber" />
            Recommendations
          </h2>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <button
                key={`${rec.jobId}-${rec.vertexId}-${rec.type}`}
                type="button"
                onClick={() => onNodeClick?.(rec.vertexId)}
                className={`w-full rounded-lg border border-white/5 border-l-2 bg-dash-elevated p-3 text-left transition-colors hover:bg-white/[0.03] ${
                  REC_COLORS[rec.type] ?? "border-l-zinc-500"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200">
                      {rec.message}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                      {rec.detail}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                    {rec.type.replace(/-/g, " ")}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  {rec.vertexName} &middot; {rec.jobName}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
