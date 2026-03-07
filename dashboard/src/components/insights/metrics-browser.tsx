import { Loader2, Plus, Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import { useClusterStore } from "@/stores/cluster-store"
import type {
  MetricSeries,
  MetricSource,
  MetricSourceType,
} from "@/stores/metrics-explorer-store"

type MetricsBrowserProps = {
  selectedSource: MetricSource | null
  availableMetrics: string[]
  activeSeries: MetricSeries[]
  onSelectSource: (source: MetricSource) => void
  onAddMetric: (metricName: string) => void
  onRemoveMetric: (seriesId: string) => void
  loading: boolean
}

const SOURCE_TABS: { type: MetricSourceType; label: string }[] = [
  { type: "jm", label: "JM" },
  { type: "tm", label: "TM" },
  { type: "job-vertex", label: "Job" },
]

export function MetricsBrowser({
  selectedSource,
  availableMetrics,
  activeSeries,
  onSelectSource,
  onAddMetric,
  onRemoveMetric,
  loading,
}: MetricsBrowserProps) {
  const [activeTab, setActiveTab] = useState<MetricSourceType>(
    selectedSource?.type ?? "jm",
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTmId, setSelectedTmId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null)

  const taskManagers = useClusterStore((s) => s.taskManagers)
  const runningJobs = useClusterStore((s) => s.runningJobs)

  // Auto-select JM source on mount if no source is selected
  useEffect(() => {
    if (!selectedSource && activeTab === "jm") {
      onSelectSource({ type: "jm", id: "jm", label: "Job Manager" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, onSelectSource, selectedSource])

  // Get vertices for selected job
  const selectedJob = useMemo(
    () => runningJobs.find((j) => j.id === selectedJobId),
    [runningJobs, selectedJobId],
  )
  const vertices = selectedJob?.plan?.vertices ?? []

  // Active series set for quick lookup
  const activeSeriesIds = useMemo(
    () => new Set(activeSeries.map((s) => s.id)),
    [activeSeries],
  )

  // Filtered metrics
  const filteredMetrics = useMemo(() => {
    if (!searchQuery) return availableMetrics
    const q = searchQuery.toLowerCase()
    return availableMetrics.filter((m) => m.toLowerCase().includes(q))
  }, [availableMetrics, searchQuery])

  function handleTabChange(type: MetricSourceType) {
    setActiveTab(type)
    setSearchQuery("")
    if (type === "jm") {
      const source: MetricSource = {
        type: "jm",
        id: "jm",
        label: "Job Manager",
      }
      onSelectSource(source)
    }
    // For TM and Job, user needs to select instance first
  }

  function handleTmSelect(tmId: string) {
    setSelectedTmId(tmId)
    const source: MetricSource = {
      type: "tm",
      id: `tm:${tmId}`,
      label: `TM ${tmId.slice(0, 8)}`,
    }
    onSelectSource(source)
  }

  function handleJobSelect(jobId: string) {
    setSelectedJobId(jobId)
    setSelectedVertexId(null)
  }

  function handleVertexSelect(vertexId: string) {
    setSelectedVertexId(vertexId)
    const vertex = vertices.find((v) => v.id === vertexId)
    if (!selectedJobId || !vertex) return
    const source: MetricSource = {
      type: "job-vertex",
      id: `job:${selectedJobId}:vertex:${vertexId}`,
      label: `${selectedJob?.name ?? "Job"} > ${vertex.name}`,
    }
    onSelectSource(source)
  }

  function handleMetricToggle(metricName: string) {
    if (!selectedSource) return
    const seriesId = `${selectedSource.id}:${metricName}`
    if (activeSeriesIds.has(seriesId)) {
      onRemoveMetric(seriesId)
    } else {
      onAddMetric(metricName)
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

      {/* Source instance selector */}
      {activeTab === "tm" && (
        <select
          value={selectedTmId ?? ""}
          onChange={(e) => e.target.value && handleTmSelect(e.target.value)}
          className="w-full rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-zinc-300 outline-none"
        >
          <option value="">Select Task Manager…</option>
          {taskManagers.map((tm) => (
            <option key={tm.id} value={tm.id}>
              TM {tm.id.slice(0, 12)}
            </option>
          ))}
        </select>
      )}

      {activeTab === "job-vertex" && (
        <div className="flex flex-col gap-1.5">
          <select
            value={selectedJobId ?? ""}
            onChange={(e) => e.target.value && handleJobSelect(e.target.value)}
            className="w-full rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-zinc-300 outline-none"
          >
            <option value="">Select Job…</option>
            {runningJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
          {selectedJobId && (
            <select
              value={selectedVertexId ?? ""}
              onChange={(e) =>
                e.target.value && handleVertexSelect(e.target.value)
              }
              className="w-full rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-zinc-300 outline-none"
            >
              <option value="">Select Vertex…</option>
              {vertices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Search input */}
      {selectedSource && (
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
      {selectedSource && (
        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-zinc-500" />
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
                const seriesId = `${selectedSource.id}:${metric}`
                const isActive = activeSeriesIds.has(seriesId)
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
      {!selectedSource && activeTab !== "jm" && (
        <div className="py-4 text-center text-xs text-zinc-600">
          {activeTab === "tm"
            ? "Select a Task Manager above"
            : "Select a Job and Vertex above"}
        </div>
      )}
    </div>
  )
}
