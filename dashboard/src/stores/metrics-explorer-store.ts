import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  fetchMetricCatalog,
  fetchMetricSeries,
  type MetricCatalogEntry,
} from "@/lib/graphql-api-client"

/**
 * Metrics explorer store — time-series metric visualization with catalog,
 * presets, and counter-to-rate conversion.
 *
 * Fetches metric catalog and series data from the Go GraphQL backend. Supports
 * multiple selected series with configurable time range and refresh interval.
 * Counter metrics are automatically converted to per-second rates. Selected
 * series and preferences are persisted to localStorage via Zustand persist.
 *
 * @module metrics-explorer-store
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point in a metric time series. */
export type MetricDataPoint = {
  /** Unix timestamp in milliseconds. */
  timestamp: number
  /** Metric value at this point. */
  value: number
}

/** Flink metric type classification. */
export type MetricType = "gauge" | "counter" | "meter"
/** Unit of measurement for a metric. */
export type MetricUnit =
  | "bytes"
  | "ms"
  | "count"
  | "ratio"
  | "records"
  | "records/s"
  | "bytes/s"
  | "segments"
/** Type and unit metadata for a metric, determined by pattern matching. */
export type MetricMeta = { type: MetricType; unit: MetricUnit }

// ---------------------------------------------------------------------------
// Metric metadata registry — pattern-matched, based on Flink docs
// ---------------------------------------------------------------------------

/** Pattern-matched metric metadata registry based on Flink metric naming conventions. */
const METRIC_PATTERNS: [RegExp, MetricMeta][] = [
  // JVM Memory (bytes)
  [
    /Status\.JVM\.Memory\..+\.(Used|Max|Committed)$/,
    { type: "gauge", unit: "bytes" },
  ],
  [/Status\.JVM\.Memory\..+\.MemoryUsed$/, { type: "gauge", unit: "bytes" }],
  [/Status\.JVM\.Memory\..+\.TotalCapacity$/, { type: "gauge", unit: "bytes" }],

  // JVM CPU
  [/Status\.JVM\.CPU\.Load$/, { type: "gauge", unit: "ratio" }],

  // JVM Threads
  [/Status\.JVM\.Threads\.Count$/, { type: "gauge", unit: "count" }],

  // JVM GC — cumulative despite Flink calling them Gauge
  [
    /Status\.JVM\.GarbageCollector\..+\.Count$/,
    { type: "counter", unit: "count" },
  ],
  [/Status\.JVM\.GarbageCollector\..+\.Time$/, { type: "counter", unit: "ms" }],

  // Shuffle / Network
  [/Status\.Shuffle\.Netty\..+Memory$/, { type: "gauge", unit: "bytes" }],
  [
    /Status\.(Shuffle\.Netty|Network)\..+Segments$/,
    { type: "gauge", unit: "segments" },
  ],

  // Flink Managed Memory
  [/Status\.Flink\.Memory\.Managed\./, { type: "gauge", unit: "bytes" }],

  // Record / byte counters
  [/numRecords(In|Out)$/, { type: "counter", unit: "records" }],
  [/numBytes(In|Out)$/, { type: "counter", unit: "bytes" }],

  // Rate meters
  [/numRecords.*PerSecond$/, { type: "meter", unit: "records/s" }],
  [/numBytes.*PerSecond$/, { type: "meter", unit: "bytes/s" }],

  // Checkpointing
  [/lastCheckpointDuration$/, { type: "gauge", unit: "ms" }],
  [/lastCheckpointSize$/, { type: "gauge", unit: "bytes" }],
  [/numberOf(Completed|Failed)Checkpoints$/, { type: "gauge", unit: "count" }],
]

const DEFAULT_META: MetricMeta = { type: "gauge", unit: "count" }

/** Look up type and unit metadata for a metric name by matching against known patterns. */
export function getMetricMeta(metricName: string): MetricMeta {
  for (const [pattern, meta] of METRIC_PATTERNS) {
    if (pattern.test(metricName)) return meta
  }
  return DEFAULT_META
}

// ---------------------------------------------------------------------------
// Time range + refresh types
// ---------------------------------------------------------------------------

export type TimeRange = "5m" | "15m" | "1h" | "6h" | "24h"
export type RefreshInterval = 5000 | 10000 | 30000 | 60000

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
}

// ---------------------------------------------------------------------------
// Selected metric type
// ---------------------------------------------------------------------------

/** A user-selected metric series with source identification and display metadata. */
export type SelectedMetric = {
  /** Source type (e.g. "job_manager", "task_manager"). */
  sourceType: string
  /** Source instance ID. */
  sourceID: string
  /** Metric identifier within the source. */
  metricID: string
  /** Human-readable label for chart legends. */
  label: string
  /** Type and unit metadata for rendering and conversion. */
  meta: MetricMeta
}

/** Build a unique key for a series from its source type, ID, and metric ID. */
function seriesKey(m: {
  sourceType: string
  sourceID: string
  metricID: string
}): string {
  return `${m.sourceType}:${m.sourceID}:${m.metricID}`
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type PresetDef = {
  sourceType: string
  sourceID: string
  metrics: string[]
}

const PRESETS: Record<string, PresetDef> = {
  "JVM Health": {
    sourceType: "job_manager",
    sourceID: "jobmanager",
    metrics: [
      "Status.JVM.Memory.Heap.Used",
      "Status.JVM.Memory.Heap.Max",
      "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
      "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
      "Status.JVM.Threads.Count",
    ],
  },
  Network: {
    sourceType: "job_manager",
    sourceID: "jobmanager",
    metrics: [
      "Status.Shuffle.Netty.UsedMemory",
      "Status.Shuffle.Netty.AvailableMemory",
      "Status.Network.AvailableMemorySegments",
      "Status.Network.TotalMemorySegments",
    ],
  },
}

export { PRESETS }

// ---------------------------------------------------------------------------
// Counter rate conversion
// ---------------------------------------------------------------------------

/** Convert cumulative counter values to per-second rates (skips negative deltas from resets). */
function computeCounterRate(points: MetricDataPoint[]): MetricDataPoint[] {
  if (points.length < 2) return []
  const result: MetricDataPoint[] = []
  for (let i = 1; i < points.length; i++) {
    const dv = points[i].value - points[i - 1].value
    const dt = (points[i].timestamp - points[i - 1].timestamp) / 1000
    if (dv >= 0 && dt > 0) {
      result.push({
        timestamp: points[i].timestamp,
        value: dv / dt,
      })
    }
    // Skip negative deltas (counter reset)
  }
  return result
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface MetricsExplorerState {
  /** Available metrics from the catalog query. */
  catalog: MetricCatalogEntry[]
  /** Whether the catalog is loading. */
  catalogLoading: boolean

  /** User-selected metric series to display on the chart. */
  selectedSeries: SelectedMetric[]

  /** Fetched + processed time-series data keyed by "sourceType:sourceID:metricID". */
  seriesData: Record<string, MetricDataPoint[]>
  /** Whether a data fetch is in progress. */
  dataLoading: boolean

  /** Active time range window for data queries. */
  timeRange: TimeRange
  /** Polling interval in milliseconds. */
  refreshInterval: RefreshInterval
  /** Whether data fetching is paused (polling continues but skips fetches). */
  isPaused: boolean
  /** Whether the polling interval is active. */
  isPolling: boolean

  /** Fetch the metric catalog from the backend. */
  fetchCatalog: () => Promise<void>
  /** Add a metric series to the chart. */
  addMetric: (
    sourceType: string,
    sourceID: string,
    metricID: string,
    label: string,
  ) => void
  /** Remove a metric series by its composite key. */
  removeMetric: (key: string) => void
  /** Remove all selected metric series and their data. */
  clearAllMetrics: () => void
  /** Replace selected series with a named preset configuration. */
  applyPreset: (presetName: string) => void
  /** Change the time range and re-fetch data. */
  setTimeRange: (range: TimeRange) => void
  /** Change the refresh interval (restarts the polling timer). */
  setRefreshInterval: (interval: RefreshInterval) => void
  /** Toggle the pause state for data fetching. */
  togglePause: () => void
  /** Start the polling interval and fetch catalog + initial data. */
  startPolling: () => void
  /** Stop the polling interval. */
  stopPolling: () => void
  /** Fetch time-series data for all selected metrics within the time range. */
  fetchData: () => Promise<void>
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export const useMetricsExplorerStore = create<MetricsExplorerState>()(
  persist(
    (set, get) => ({
      catalog: [],
      catalogLoading: false,

      selectedSeries: [],

      seriesData: {},
      dataLoading: false,

      timeRange: "15m",
      refreshInterval: 5000,
      isPaused: false,
      isPolling: false,

      fetchCatalog: async () => {
        set({ catalogLoading: true })
        try {
          const catalog = await fetchMetricCatalog("default")
          set({ catalog, catalogLoading: false })
        } catch {
          set({ catalogLoading: false })
        }
      },

      addMetric: (sourceType, sourceID, metricID, label) => {
        const key = seriesKey({ sourceType, sourceID, metricID })
        if (get().selectedSeries.some((s) => seriesKey(s) === key)) return

        const metric: SelectedMetric = {
          sourceType,
          sourceID,
          metricID,
          label,
          meta: getMetricMeta(metricID),
        }
        set((state) => ({
          selectedSeries: [...state.selectedSeries, metric],
        }))

        // Immediately fetch data if polling is active
        if (get().isPolling && !get().isPaused) {
          get().fetchData()
        }
      },

      removeMetric: (key) => {
        set((state) => ({
          selectedSeries: state.selectedSeries.filter(
            (s) => seriesKey(s) !== key,
          ),
          seriesData: Object.fromEntries(
            Object.entries(state.seriesData).filter(([k]) => k !== key),
          ),
        }))
      },

      clearAllMetrics: () => {
        set({ selectedSeries: [], seriesData: {} })
      },

      applyPreset: (presetName) => {
        const preset = PRESETS[presetName]
        if (!preset) return

        const newSeries: SelectedMetric[] = preset.metrics.map((metricID) => ({
          sourceType: preset.sourceType,
          sourceID: preset.sourceID,
          metricID,
          label: metricID.split(".").slice(-2).join("."),
          meta: getMetricMeta(metricID),
        }))

        set({ selectedSeries: newSeries, seriesData: {} })

        // Immediately fetch data
        if (get().isPolling && !get().isPaused) {
          get().fetchData()
        }
      },

      setTimeRange: (range) => {
        set({ timeRange: range })
        // Re-fetch immediately with new range
        if (get().isPolling && !get().isPaused) {
          get().fetchData()
        }
      },

      setRefreshInterval: (interval) => {
        set({ refreshInterval: interval })
        // Restart polling with new interval
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = setInterval(() => get().fetchData(), interval)
        }
      },

      togglePause: () => {
        set((state) => ({ isPaused: !state.isPaused }))
      },

      startPolling: () => {
        if (pollTimer) return
        set({ isPolling: true })
        const interval = get().refreshInterval
        // Fetch catalog + data immediately
        get().fetchCatalog()
        get().fetchData()
        pollTimer = setInterval(() => {
          if (!get().isPaused) {
            get().fetchData()
          }
        }, interval)
      },

      stopPolling: () => {
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        set({ isPolling: false })
      },

      fetchData: async () => {
        const { selectedSeries, timeRange, isPaused } = get()
        if (isPaused || selectedSeries.length === 0) return

        set({ dataLoading: true })

        const now = Date.now()
        const after = new Date(now - TIME_RANGE_MS[timeRange]).toISOString()
        const before = new Date(now).toISOString()

        try {
          const results = await fetchMetricSeries({
            clusterID: "default",
            series: selectedSeries.map((s) => ({
              sourceType: s.sourceType,
              sourceID: s.sourceID,
              metricID: s.metricID,
            })),
            after,
            before,
            maxPoints: 500,
          })

          const newSeriesData: Record<string, MetricDataPoint[]> = {}

          for (const ts of results) {
            const key = seriesKey(ts)
            // Convert capturedAt strings to timestamp numbers
            const rawPoints: MetricDataPoint[] = ts.points.map((p) => ({
              timestamp: new Date(p.capturedAt).getTime(),
              value: p.value,
            }))

            // Find the meta for this series
            const selected = selectedSeries.find((s) => seriesKey(s) === key)
            if (selected?.meta.type === "counter") {
              // Counter → rate conversion
              newSeriesData[key] = computeCounterRate(rawPoints)
            } else {
              newSeriesData[key] = rawPoints
            }
          }

          set({ seriesData: newSeriesData, dataLoading: false })
        } catch {
          set({ dataLoading: false })
        }
      },
    }),
    {
      name: "metrics-explorer",
      partialize: (state) => ({
        selectedSeries: state.selectedSeries,
        timeRange: state.timeRange,
        refreshInterval: state.refreshInterval,
      }),
    },
  ),
)
