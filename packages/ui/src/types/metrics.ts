// ---------------------------------------------------------------------------
// Metrics explorer types
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

export type TimeRange = "5m" | "15m" | "1h" | "6h" | "24h"

export type RefreshInterval = 5000 | 10000 | 30000 | 60000

export type SelectedMetric = {
  sourceType: string
  sourceID: string
  metricID: string
  label: string
  meta: MetricMeta
}
