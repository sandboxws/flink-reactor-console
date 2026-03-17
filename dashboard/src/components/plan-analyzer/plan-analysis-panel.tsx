import {
  AlertTriangle,
  GitGraph,
  Lightbulb,
  Database,
} from "lucide-react"
import type { AnalyzedFlinkPlan } from "@/lib/plan-analyzer/types"
import { cn } from "@/lib/cn"
import { usePlanAnalyzerStore } from "@/stores/plan-analyzer-store"
import { PlanAntiPatternCard } from "./plan-anti-pattern-card"
import { PlanDAG } from "./plan-dag"
import { PlanStateForecast } from "./plan-state-forecast"

type Tab = "dag" | "analysis" | "recommendations" | "state"

const TABS: { id: Tab; label: string; icon: typeof GitGraph }[] = [
  { id: "dag", label: "DAG", icon: GitGraph },
  { id: "analysis", label: "Analysis", icon: AlertTriangle },
  { id: "recommendations", label: "Recommendations", icon: Lightbulb },
  { id: "state", label: "State", icon: Database },
]

export function PlanAnalysisPanel({ plan }: { plan: AnalyzedFlinkPlan }) {
  const activeTab = usePlanAnalyzerStore((s) => s.activeTab)
  const setActiveTab = usePlanAnalyzerStore((s) => s.setActiveTab)
  const selectedNodeId = usePlanAnalyzerStore((s) => s.selectedNodeId)
  const selectNode = usePlanAnalyzerStore((s) => s.selectNode)

  const issueCount = plan.antiPatterns.length
  const recCount = plan.recommendations.length
  const stateCount = plan.stateForecasts.length

  return (
    <div className="flex h-full flex-col">
      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className="flex h-9 items-center gap-1 border-b border-dash-border px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const count =
            tab.id === "analysis"
              ? issueCount
              : tab.id === "recommendations"
                ? recCount
                : tab.id === "state"
                  ? stateCount
                  : 0
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors",
                activeTab === tab.id
                  ? "bg-dash-elevated text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Icon className="size-3" />
              {tab.label}
              {count > 0 && (
                <span className="rounded-full bg-white/5 px-1.5 text-[9px] tabular-nums text-zinc-400">
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Summary badges */}
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500">
            {plan.totalNodes} operators
          </span>
          <span className="text-zinc-500">{plan.workloadType}</span>
          <span className="text-zinc-500">{plan.jobType}</span>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "dag" && (
          <PlanDAG
            plan={plan}
            selectedNodeId={selectedNodeId}
            onNodeSelect={selectNode}
          />
        )}

        {activeTab === "analysis" && (
          <div className="h-full overflow-y-auto p-3">
            {plan.antiPatterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <AlertTriangle className="mb-2 size-5" />
                <span className="text-xs">No issues detected</span>
              </div>
            ) : (
              <div className="space-y-2">
                {plan.antiPatterns.map((ap) => (
                  <PlanAntiPatternCard key={ap.id} antiPattern={ap} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="h-full overflow-y-auto p-3">
            {plan.recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Lightbulb className="mb-2 size-5" />
                <span className="text-xs">No recommendations</span>
              </div>
            ) : (
              <div className="space-y-2">
                {plan.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-lg border border-white/5 bg-dash-elevated p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-medium",
                          rec.severity === "critical"
                            ? "bg-job-failed/15 text-job-failed"
                            : rec.severity === "warning"
                              ? "bg-fr-amber/15 text-fr-amber"
                              : "bg-zinc-500/15 text-zinc-400",
                        )}
                      >
                        {rec.severity}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-medium bg-white/5 text-zinc-400",
                        )}
                      >
                        {rec.category}
                      </span>
                      <span className="text-xs font-medium text-zinc-200">
                        {rec.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400">
                      {rec.description}
                    </p>
                    <div className="mt-2 rounded bg-dash-panel px-2.5 py-1.5 text-[11px] text-zinc-300">
                      {rec.solution}
                    </div>
                    {rec.sqlConfig && (
                      <pre className="mt-1.5 overflow-x-auto rounded bg-fr-bg p-2 text-[10px] text-zinc-300">
                        {rec.sqlConfig}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "state" && (
          <div className="h-full overflow-y-auto p-3">
            <PlanStateForecast forecasts={plan.stateForecasts} />
          </div>
        )}
      </div>
    </div>
  )
}
