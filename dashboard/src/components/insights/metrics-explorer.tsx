import { LineChart, Pause, Play, Trash2 } from "lucide-react"
import { cn } from "@/lib/cn"
import type {
  RefreshInterval,
  TimeRange,
} from "@/stores/metrics-explorer-store"
import { useMetricsExplorerStore } from "@/stores/metrics-explorer-store"
import { getChartColor, MetricChart } from "./metric-chart"
import { MetricsBrowser } from "./metrics-browser"
import { PresetSelector } from "./preset-selector"

const INTERVAL_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
  { value: 60000, label: "1m" },
]

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
]

function seriesKey(m: {
  sourceType: string
  sourceID: string
  metricID: string
}): string {
  return `${m.sourceType}:${m.sourceID}:${m.metricID}`
}

function sourceBadge(sourceType: string): string {
  switch (sourceType) {
    case "job_manager":
      return "JM"
    case "task_manager":
      return "TM"
    case "vertex":
      return "Vertex"
    default:
      return sourceType
  }
}

export function MetricsExplorer() {
  const catalog = useMetricsExplorerStore((s) => s.catalog)
  const catalogLoading = useMetricsExplorerStore((s) => s.catalogLoading)
  const selectedSeries = useMetricsExplorerStore((s) => s.selectedSeries)
  const seriesData = useMetricsExplorerStore((s) => s.seriesData)
  const refreshInterval = useMetricsExplorerStore((s) => s.refreshInterval)
  const timeRange = useMetricsExplorerStore((s) => s.timeRange)
  const isPaused = useMetricsExplorerStore((s) => s.isPaused)

  const addMetric = useMetricsExplorerStore((s) => s.addMetric)
  const removeMetric = useMetricsExplorerStore((s) => s.removeMetric)
  const clearAllMetrics = useMetricsExplorerStore((s) => s.clearAllMetrics)
  const applyPreset = useMetricsExplorerStore((s) => s.applyPreset)
  const setRefreshInterval = useMetricsExplorerStore(
    (s) => s.setRefreshInterval,
  )
  const setTimeRange = useMetricsExplorerStore((s) => s.setTimeRange)
  const togglePause = useMetricsExplorerStore((s) => s.togglePause)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
        <h1 className="text-sm font-semibold text-zinc-200">
          Metrics Explorer
        </h1>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5">
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeRange(opt.value)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  timeRange === opt.value
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-400",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-zinc-700" />

          {/* Refresh interval selector */}
          <div className="flex items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRefreshInterval(opt.value)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  refreshInterval === opt.value
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-400",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Pause/Resume */}
          <button
            type="button"
            onClick={togglePause}
            className={cn(
              "rounded-md border p-1.5 transition-colors",
              isPaused
                ? "border-zinc-600 text-zinc-400 hover:text-zinc-200"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-400",
            )}
            title={isPaused ? "Resume polling" : "Pause polling"}
          >
            {isPaused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
          </button>

          {/* Clear all */}
          {selectedSeries.length > 0 && (
            <button
              type="button"
              onClick={clearAllMetrics}
              className="rounded-md border border-zinc-700 p-1.5 text-zinc-500 transition-colors hover:text-zinc-400"
              title="Clear all metrics"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left panel — Metric browser + presets */}
        <div className="w-80 shrink-0 overflow-y-auto">
          <div className="glass-card p-3">
            <MetricsBrowser
              catalog={catalog}
              catalogLoading={catalogLoading}
              selectedSeries={selectedSeries}
              onAddMetric={addMetric}
              onRemoveMetric={removeMetric}
            />
            <PresetSelector onApply={applyPreset} />
          </div>
        </div>

        {/* Right panel — Chart grid */}
        <div className="flex-1 overflow-y-auto">
          {selectedSeries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <LineChart className="size-10 text-zinc-700" />
              <p className="text-sm">
                Select metrics from the browser to start monitoring
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {selectedSeries.map((s, i) => {
                const key = seriesKey(s)
                return (
                  <MetricChart
                    key={key}
                    data={seriesData[key] ?? []}
                    meta={s.meta}
                    label={s.metricID}
                    sourceBadge={sourceBadge(s.sourceType)}
                    color={getChartColor(i)}
                    onRemove={() => removeMetric(key)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
