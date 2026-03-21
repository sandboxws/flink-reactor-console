"use client"

import { FileSearch } from "lucide-react"
import { PlanAntiPatternCard } from "../../components/plan-analyzer/plan-anti-pattern-card"
import { PlanStateForecast } from "../../components/plan-analyzer/plan-state-forecast"
import { EmptyState } from "../../shared/empty-state"
import type {
  FlinkAntiPattern,
  StateGrowthForecast,
} from "../../types/plan-analyzer"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlanAnalyzerSectionProps {
  plan: unknown
  antiPatterns: FlinkAntiPattern[]
  forecast: StateGrowthForecast[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanAnalyzerSection({
  antiPatterns,
  forecast,
}: PlanAnalyzerSectionProps) {
  const hasContent = antiPatterns.length > 0 || forecast.length > 0

  if (!hasContent) {
    return (
      <EmptyState
        icon={FileSearch}
        message="No anti-patterns or state forecasts detected in this plan."
      />
    )
  }

  return (
    <section className="space-y-6 p-4">
      {/* Anti-patterns */}
      {antiPatterns.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              Anti-Patterns
            </h2>
            <span className="rounded-full bg-job-failed/15 px-2 py-0.5 text-[10px] font-medium text-job-failed">
              {antiPatterns.length} issue{antiPatterns.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {antiPatterns.map((ap) => (
              <PlanAntiPatternCard key={ap.id} antiPattern={ap} />
            ))}
          </div>
        </div>
      )}

      {/* State forecast */}
      {forecast.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">
            State Growth Forecast
          </h2>
          <PlanStateForecast forecasts={forecast} />
        </div>
      )}
    </section>
  )
}
