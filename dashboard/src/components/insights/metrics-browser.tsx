import { Spinner } from "@flink-reactor/ui"
import { Plus, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import type { MetricCatalogEntry } from "@/lib/graphql-api-client"
import type { SelectedMetric } from "@/stores/metrics-explorer-store"

type SourceTab = "job_manager" | "task_manager" | "vertex"

const SOURCE_TABS: { type: SourceTab; label: string }[] = [
  { type: "job_manager", label: "JM" },
  { type: "task_manager", label: "TM" },
  { type: "vertex", label: "Vertex" },
]

function seriesKey(m: {
  sourceType: string
  sourceID: string
  metricID: string
}): string {
  return `${m.sourceType}:${m.sourceID}:${m.metricID}`
}

type MetricsBrowserProps = {
  catalog: MetricCatalogEntry[]
  catalogLoading: boolean
  selectedSeries: SelectedMetric[]
  onAddMetric: (
    sourceType: string,
    sourceID: string,
    metricID: string,
    label: string,
  ) => void
  onRemoveMetric: (key: string) => void
}

export function MetricsBrowser({
  catalog,
  catalogLoading,
  selectedSeries,
  onAddMetric,
  onRemoveMetric,
}: MetricsBrowserProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("job_manager")
  const [selectedSourceID, setSelectedSourceID] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Active series keys for quick lookup
  const activeKeys = useMemo(
    () => new Set(selectedSeries.map((s) => seriesKey(s))),
    [selectedSeries],
  )

  // Group catalog by source type
  const sourceTypes = useMemo(() => {
    const byType = new Map<string, MetricCatalogEntry[]>()
    for (const entry of catalog) {
      const existing = byType.get(entry.sourceType)
      if (existing) {
        existing.push(entry)
      } else {
        byType.set(entry.sourceType, [entry])
      }
    }
    return byType
  }, [catalog])

  // Get entries for active tab
  const tabEntries = sourceTypes.get(activeTab) ?? []

  // Get unique source IDs for the active tab
  const sourceIDs = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of tabEntries) {
      ids.add(entry.sourceID)
    }
    return Array.from(ids).sort()
  }, [tabEntries])

  // Auto-select source ID for JM (always "jobmanager")
  const effectiveSourceID =
    activeTab === "job_manager" ? (sourceIDs[0] ?? null) : selectedSourceID

  // Get metrics for the selected source
  const availableMetrics = useMemo(() => {
    if (!effectiveSourceID) return []
    return tabEntries
      .filter((e) => e.sourceID === effectiveSourceID)
      .map((e) => e.metricID)
      .sort()
  }, [tabEntries, effectiveSourceID])

  // Filtered metrics
  const filteredMetrics = useMemo(() => {
    if (!searchQuery) return availableMetrics
    const q = searchQuery.toLowerCase()
    return availableMetrics.filter((m) => m.toLowerCase().includes(q))
  }, [availableMetrics, searchQuery])

  function handleTabChange(type: SourceTab) {
    setActiveTab(type)
    setSelectedSourceID(null)
    setSearchQuery("")
  }

  function handleMetricToggle(metricID: string) {
    if (!effectiveSourceID) return
    const key = seriesKey({
      sourceType: activeTab,
      sourceID: effectiveSourceID,
      metricID,
    })
    if (activeKeys.has(key)) {
      onRemoveMetric(key)
    } else {
      onAddMetric(activeTab, effectiveSourceID, metricID, metricID)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Source type tabs */}
      <div className="flex gap-1 rounded-md bg-white/[0.04] p-0.5">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => handleTabChange(tab.type)}
            className={cn(
              "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              activeTab === tab.type
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-400",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Source ID selector (for TM and Vertex) */}
      {activeTab !== "job_manager" && (
        <select
          value={selectedSourceID ?? ""}
          onChange={(e) =>
            e.target.value && setSelectedSourceID(e.target.value)
          }
          className="w-full rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-zinc-300 outline-none"
        >
          <option value="">
            {activeTab === "task_manager"
              ? "Select Task Manager…"
              : "Select Vertex…"}
          </option>
          {sourceIDs.map((id) => (
            <option key={id} value={id}>
              {activeTab === "task_manager"
                ? `TM ${id.slice(0, 12)}`
                : id.slice(0, 16)}
            </option>
          ))}
        </select>
      )}

      {/* Search input */}
      {effectiveSourceID && (
        <div className="flex items-center gap-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1">
          <Search className="size-3.5 shrink-0 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search metrics…"
            className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-zinc-500 hover:text-zinc-400"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* Metric list */}
      {effectiveSourceID && (
        <div className="max-h-[360px] overflow-y-auto">
          {catalogLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : filteredMetrics.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-600">
              {searchQuery
                ? "No metrics match your search"
                : "No metrics available"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredMetrics.map((metric) => {
                const key = seriesKey({
                  sourceType: activeTab,
                  sourceID: effectiveSourceID,
                  metricID: metric,
                })
                const isActive = activeKeys.has(key)
                return (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => handleMetricToggle(metric)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors",
                      isActive
                        ? "bg-white/[0.06] text-zinc-200"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate" title={metric}>
                      {metric}
                    </span>
                    {isActive ? (
                      <X className="size-3 shrink-0 text-zinc-500 group-hover:text-zinc-400" />
                    ) : (
                      <Plus className="size-3 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* No source selected message */}
      {!effectiveSourceID && activeTab !== "job_manager" && (
        <div className="py-4 text-center text-xs text-zinc-600">
          {activeTab === "task_manager"
            ? "Select a Task Manager above"
            : "Select a Vertex above"}
        </div>
      )}
    </div>
  )
}
