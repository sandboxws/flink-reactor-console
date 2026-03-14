import { create } from "zustand"
import { fetchMetricList, fetchMetricValues } from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricSourceType = "jm" | "tm" | "job-vertex"

export type MetricSource = {
  type: MetricSourceType
  id: string // "jm", "tm:{tmId}", "job:{jid}:vertex:{vid}"
  label: string // "Job Manager", "TM abc123", "OrderProcessing > Map"
}

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

export type MetricSeries = {
  id: string // "${source.id}:${metricName}"
  source: MetricSource
  metricName: string
  meta: MetricMeta
  data: MetricDataPoint[]
  currentValue: number | null
  minValue: number | null
  maxValue: number | null
}

export type RefreshInterval = 5000 | 10000 | 30000 | 60000 | 3_600_000

// ---------------------------------------------------------------------------
// Ring buffer — O(1) push, no reallocation
// ---------------------------------------------------------------------------

class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private writePtr = 0
  private count = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.writePtr] = item
    this.writePtr = (this.writePtr + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  toArray(): T[] {
    if (this.count === 0) return []
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count) as T[]
    }
    return [
      ...this.buffer.slice(this.writePtr),
      ...this.buffer.slice(0, this.writePtr),
    ] as T[]
  }
}

const MAX_DATA_POINTS = 200

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type PresetDef = {
  source: MetricSourceType
  metrics: string[]
}

const PRESETS: Record<string, PresetDef> = {
  "JVM Health": {
    source: "jm",
    metrics: [
      "Status.JVM.Memory.Heap.Used",
      "Status.JVM.Memory.Heap.Max",
      "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
      "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
      "Status.JVM.Threads.Count",
    ],
  },
  Network: {
    source: "jm",
    metrics: [
      "Status.Shuffle.Netty.UsedMemory",
      "Status.Shuffle.Netty.AvailableMemory",
      "Status.Network.AvailableMemorySegments",
      "Status.Network.TotalMemorySegments",
    ],
  },
  Checkpointing: {
    source: "job-vertex",
    metrics: [
      "lastCheckpointDuration",
      "lastCheckpointSize",
      "numberOfCompletedCheckpoints",
      "numberOfFailedCheckpoints",
    ],
  },
}

export { PRESETS }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceToProxyUrl(source: MetricSource): string {
  switch (source.type) {
    case "jm":
      return "/api/flink/jobmanager/metrics"
    case "tm": {
      const tmId = source.id.replace("tm:", "")
      return `/api/flink/taskmanagers/${tmId}/metrics`
    }
    case "job-vertex": {
      // id format: "job:{jid}:vertex:{vid}"
      const match = source.id.match(/^job:(.+):vertex:(.+)$/)
      if (!match) return "/api/flink/jobmanager/metrics"
      return `/api/flink/jobs/${match[1]}/vertices/${match[2]}/metrics`
    }
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface MetricsExplorerState {
  // Source browsing
  selectedSource: MetricSource | null
  availableMetrics: string[]
  metricsLoading: boolean

  // Active series
  series: MetricSeries[]

  // Refresh control
  refreshInterval: RefreshInterval
  isPaused: boolean
  isPolling: boolean

  // Actions
  selectSource: (source: MetricSource) => void
  fetchAvailableMetrics: (source: MetricSource) => Promise<void>
  addMetric: (source: MetricSource, metricName: string) => void
  removeMetric: (seriesId: string) => void
  clearAllMetrics: () => void
  applyPreset: (presetName: string) => void
  setRefreshInterval: (interval: RefreshInterval) => void
  togglePause: () => void
  startPolling: () => void
  stopPolling: () => void
}

// Per-series ring buffers, keyed by series ID
const ringBuffers = new Map<string, RingBuffer<MetricDataPoint>>()
// Previous raw values for counter → rate conversion
const previousRawValues = new Map<
  string,
  { value: number; timestamp: number }
>()
let pollInterval: ReturnType<typeof setInterval> | null = null

async function pollMetrics(
  set: (
    fn: (state: MetricsExplorerState) => Partial<MetricsExplorerState>,
  ) => void,
  get: () => MetricsExplorerState,
) {
  const { series, isPaused } = get()
  if (isPaused || series.length === 0) return

  // Group metrics by source for batched fetching
  const grouped = new Map<
    string,
    { source: MetricSource; metricNames: string[] }
  >()
  for (const s of series) {
    const existing = grouped.get(s.source.id)
    if (existing) {
      existing.metricNames.push(s.metricName)
    } else {
      grouped.set(s.source.id, {
        source: s.source,
        metricNames: [s.metricName],
      })
    }
  }

  // Fetch all source groups in parallel
  const results = await Promise.allSettled(
    Array.from(grouped.values()).map(async ({ source, metricNames }) => {
      const url = sourceToProxyUrl(source)
      const values = await fetchMetricValues(url, metricNames)
      return { sourceId: source.id, values }
    }),
  )

  // Collect values by source
  const valuesBySource = new Map<string, Record<string, number>>()
  for (const result of results) {
    if (result.status === "fulfilled") {
      valuesBySource.set(result.value.sourceId, result.value.values)
    }
  }

  const now = Date.now()

  set((state) => {
    const updatedSeries = state.series.map((s) => {
      const sourceValues = valuesBySource.get(s.source.id)
      if (!sourceValues || !(s.metricName in sourceValues)) return s

      const rawValue = sourceValues[s.metricName]

      // For counters, convert cumulative value → rate (/s)
      let chartValue: number | null = null
      if (s.meta.type === "counter") {
        const prev = previousRawValues.get(s.id)
        previousRawValues.set(s.id, { value: rawValue, timestamp: now })
        if (prev) {
          const delta = rawValue - prev.value
          const elapsedSec = (now - prev.timestamp) / 1000
          if (delta >= 0 && elapsedSec > 0) {
            chartValue = delta / elapsedSec
          }
          // delta < 0 means counter reset — skip this point
        }
        // No prev means first poll — skip (establishes baseline)
      } else {
        chartValue = rawValue
      }

      // Skip if we couldn't compute a value (first counter poll or reset)
      if (chartValue === null) return s

      const point: MetricDataPoint = { timestamp: now, value: chartValue }

      let rb = ringBuffers.get(s.id)
      if (!rb) {
        rb = new RingBuffer<MetricDataPoint>(MAX_DATA_POINTS)
        ringBuffers.set(s.id, rb)
      }
      rb.push(point)

      const newMin =
        s.minValue === null ? chartValue : Math.min(s.minValue, chartValue)
      const newMax =
        s.maxValue === null ? chartValue : Math.max(s.maxValue, chartValue)

      return {
        ...s,
        data: rb.toArray(),
        currentValue: chartValue,
        minValue: newMin,
        maxValue: newMax,
      }
    })

    return { series: updatedSeries }
  })
}

export const useMetricsExplorerStore = create<MetricsExplorerState>(
  (set, get) => ({
    selectedSource: null,
    availableMetrics: [],
    metricsLoading: false,

    series: [],

    refreshInterval: 5000,
    isPaused: false,
    isPolling: false,

    selectSource: (source) => {
      set({
        selectedSource: source,
        availableMetrics: [],
        metricsLoading: true,
      })
      get().fetchAvailableMetrics(source)
    },

    fetchAvailableMetrics: async (source) => {
      try {
        const url = sourceToProxyUrl(source)
        const metrics = await fetchMetricList(url)
        // Only update if this source is still selected
        if (get().selectedSource?.id === source.id) {
          set({ availableMetrics: metrics, metricsLoading: false })
        }
      } catch {
        if (get().selectedSource?.id === source.id) {
          set({ availableMetrics: [], metricsLoading: false })
        }
      }
    },

    addMetric: (source, metricName) => {
      const seriesId = `${source.id}:${metricName}`
      // Don't add duplicates
      if (get().series.some((s) => s.id === seriesId)) return

      const newSeries: MetricSeries = {
        id: seriesId,
        source,
        metricName,
        meta: getMetricMeta(metricName),
        data: [],
        currentValue: null,
        minValue: null,
        maxValue: null,
      }

      // Create a fresh ring buffer
      ringBuffers.set(
        seriesId,
        new RingBuffer<MetricDataPoint>(MAX_DATA_POINTS),
      )

      set((state) => ({ series: [...state.series, newSeries] }))

      // If polling is active, immediately fetch the first value
      if (get().isPolling && !get().isPaused) {
        pollMetrics(set, get)
      }
    },

    removeMetric: (seriesId) => {
      ringBuffers.delete(seriesId)
      previousRawValues.delete(seriesId)
      set((state) => ({
        series: state.series.filter((s) => s.id !== seriesId),
      }))
    },

    clearAllMetrics: () => {
      ringBuffers.clear()
      previousRawValues.clear()
      set({ series: [] })
    },

    applyPreset: (presetName) => {
      const preset = PRESETS[presetName]
      if (!preset) return

      // For JM presets, auto-create the source
      let source: MetricSource
      if (preset.source === "jm") {
        source = { type: "jm", id: "jm", label: "Job Manager" }
      } else {
        // job-vertex presets require an active job-vertex source
        const selected = get().selectedSource
        if (!selected || selected.type !== "job-vertex") return
        source = selected
      }

      // Clear existing and add all preset metrics
      ringBuffers.clear()
      previousRawValues.clear()
      const newSeries: MetricSeries[] = preset.metrics.map((metricName) => {
        const id = `${source.id}:${metricName}`
        ringBuffers.set(id, new RingBuffer<MetricDataPoint>(MAX_DATA_POINTS))
        return {
          id,
          source,
          metricName,
          meta: getMetricMeta(metricName),
          data: [],
          currentValue: null,
          minValue: null,
          maxValue: null,
        }
      })

      set({ series: newSeries, selectedSource: source })

      // Fetch available metrics for the preset source
      get().fetchAvailableMetrics(source)

      // Immediately poll if active
      if (get().isPolling && !get().isPaused) {
        pollMetrics(set, get)
      }
    },

    setRefreshInterval: (interval) => {
      set({ refreshInterval: interval })
      // Restart polling with new interval
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = setInterval(() => pollMetrics(set, get), interval)
      }
    },

    togglePause: () => {
      set((state) => ({ isPaused: !state.isPaused }))
    },

    startPolling: () => {
      if (pollInterval) return
      set({ isPolling: true })
      const interval = get().refreshInterval
      // Immediate first poll
      pollMetrics(set, get)
      pollInterval = setInterval(() => pollMetrics(set, get), interval)
    },

    stopPolling: () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      set({ isPolling: false })
    },
  }),
)
