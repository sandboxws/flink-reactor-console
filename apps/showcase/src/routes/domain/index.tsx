import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { cn } from "@flink-reactor/ui"
import { ChevronDown, ChevronRight } from "lucide-react"

const DOMAINS = [
  {
    name: "Overview",
    components: ["StatCard", "ClusterInfo", "SlotUtilization", "JobStatusSummary"],
  },
  {
    name: "Jobs",
    components: [
      "JobsTable", "JobHistoryTable", "JobHeader", "OperatorNode",
      "StrategyEdge", "SourceSinkCard", "SourcesSinksTab", "CheckpointsTab",
      "ConfigurationTab", "ExceptionsTab", "VerticesTab", "DataSkewTab", "TimelineTab",
    ],
  },
  {
    name: "Logs",
    components: ["LogLine", "LogList", "LogDetailPanel", "LogHistogram"],
  },
  {
    name: "Errors",
    components: ["ErrorDetail", "ErrorTimeline"],
  },
  {
    name: "Monitoring",
    components: ["AlertCard", "CheckpointTimelineChart", "StateSizeChart", "CheckpointJobTable"],
  },
  {
    name: "Insights",
    components: ["HealthTrendChart", "SubScoreGrid", "TopIssuesList", "BottleneckDag", "BottleneckTable"],
  },
  {
    name: "Plan Analyzer",
    components: ["PlanDag", "PlanOperatorNode", "PlanStrategyEdge", "PlanAntiPatternCard", "PlanStateForecast"],
  },
  {
    name: "Catalogs",
    components: ["ColumnsTable", "TemplateSelector", "SqlHighlight"],
  },
  {
    name: "Tap",
    components: ["TapDataTable", "TapStatusBar", "TapSourceConfig", "TapErrorPanel"],
  },
  {
    name: "Materialized Tables",
    components: ["RefreshStatusBadge"],
  },
]

function DomainPage() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Domain Components</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((d) => {
          const isOpen = expanded === d.name
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => setExpanded(isOpen ? null : d.name)}
              className="glass-card p-5 text-left transition-all"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-fg">{d.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-fr-purple/20 px-2 py-0.5 text-xs font-medium text-fr-purple">
                    {d.components.length}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="size-4 text-fg-muted" />
                  ) : (
                    <ChevronRight className="size-4 text-fg-muted" />
                  )}
                </div>
              </div>
              {isOpen && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.components.map((c) => (
                    <span
                      key={c}
                      className={cn(
                        "rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-fg-secondary",
                      )}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/domain/")({
  component: DomainPage,
})
