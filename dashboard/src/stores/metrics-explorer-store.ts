import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  fetchMetricCatalog,
  fetchMetricSeries,
  type MetricCatalogEntry,
} from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricDataPoint = {
  timestamp: number
  value: number
}

export type MetricType = "gauge" | "counter" | "meter"
export type MetricUnit =
  | "bytes"
  | "ms"
  | "count"
  | "ratio"
  | "records"
  | "records/s"
  | "bytes/s"
  | "segments"
export type MetricMeta = { type: MetricType; unit: MetricUnit }

// ---------------------------------------------------------------------------
// Metric metadata registry — pattern-matched, based on Flink docs
// ---------------------------------------------------------------------------

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

export type SelectedMetric = {
  sourceType: string
  sourceID: string
  metricID: string
  label: string
  meta: MetricMeta
}

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
  // Catalog (from DB)
  catalog: MetricCatalogEntry[]
  catalogLoading: boolean

  // Selected series
  selectedSeries: SelectedMetric[]

  // Time-series data (fetched, processed)
  seriesData: Record<string, MetricDataPoint[]> // key = "sourceType:sourceID:metricID"
  dataLoading: boolean

  // Time range + refresh
  timeRange: TimeRange
  refreshInterval: RefreshInterval
  isPaused: boolean
  isPolling: boolean

  // Actions
  fetchCatalog: () => Promise<void>
  addMetric: (
    sourceType: string,
    sourceID: string,
    metricID: string,
    label: string,
  ) => void
  removeMetric: (key: string) => void
  clearAllMetrics: () => void
  applyPreset: (presetName: string) => void
  setTimeRange: (range: TimeRange) => void
  setRefreshInterval: (interval: RefreshInterval) => void
  togglePause: () => void
  startPolling: () => void
  stopPolling: () => void
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
