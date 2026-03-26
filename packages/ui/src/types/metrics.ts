/** Metrics explorer types for browsing and charting Flink metrics. */

/** A single data point in a metric time series. */
export type MetricDataPoint = {
  /** Epoch milliseconds. */
  timestamp: number
  value: number
}

/** Flink metric type classification. */
export type MetricType = "gauge" | "counter" | "meter"

/** Unit of measurement for a metric value. */
export type MetricUnit =
  | "bytes"
  | "ms"
  | "count"
  | "ratio"
  | "records"
  | "records/s"
  | "bytes/s"
  | "segments"

/** Metadata describing a metric's type and unit. */
export type MetricMeta = { type: MetricType; unit: MetricUnit }

/** Selectable time range for metric charts. */
export type TimeRange = "5m" | "15m" | "1h" | "6h" | "24h"

/** Polling interval for metric data refresh in milliseconds. */
export type RefreshInterval = 5000 | 10000 | 30000 | 60000

/** A metric selected for display in the metrics explorer. */
export type SelectedMetric = {
  /** Source type (e.g. "jobmanager", "taskmanager", "vertex"). */
  sourceType: string
  /** Source instance ID. */
  sourceID: string
  /** Metric identifier from the Flink REST API. */
  metricID: string
  /** Human-readable label for the chart legend. */
  label: string
  meta: MetricMeta
}
