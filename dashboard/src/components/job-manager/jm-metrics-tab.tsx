/**
 * @module jm-metrics-tab
 *
 * Live JVM and system metrics tab for the Job Manager. Renders four
 * time-series charts (heap, non-heap, thread count, GC count/time)
 * using Recharts. Polls the GraphQL endpoint at the configured interval
 * and accumulates up to 30 samples in a ref to avoid re-renders on
 * every intermediate state update.
 */

import { format } from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatBytes } from "@flink-reactor/ui"
import type { JobManagerMetrics, JvmMetricSample } from "@flink-reactor/ui"
import { fetchJobManagerMetrics } from "@/lib/graphql-api-client"
import { useConfigStore } from "@/stores/config-store"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Single-value chart data point with a formatted time label. */
type DataPoint = { time: string; value: number }

/** Convert {@link JvmMetricSample} array to Recharts-compatible data points. */
function toDataPoints(samples: JvmMetricSample[]): DataPoint[] {
  return samples.map((s) => ({
    time: format(s.timestamp, "HH:mm:ss"),
    value: s.value,
  }))
}

/** Dual-value chart data point for GC count + time overlay. */
type DualDataPoint = { time: string; count: number; timeMs: number }

/** Zip GC count and time sample arrays into dual-axis data points. */
function toDualDataPoints(
  countSamples: JvmMetricSample[],
  timeSamples: JvmMetricSample[],
): DualDataPoint[] {
  return countSamples.map((s, i) => ({
    time: format(s.timestamp, "HH:mm:ss"),
    count: s.value,
    timeMs: timeSamples[i]?.value ?? 0,
  }))
}

/** Custom Recharts tooltip for single-metric area/line charts. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number; color: string; name: string }>
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-fg-secondary">
            {unit === "bytes"
              ? formatBytes(item.value)
              : unit === "ms"
                ? `${item.value.toFixed(0)} ms`
                : item.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Custom Recharts tooltip for the dual-axis GC chart (count + time). */
function DualChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    value: number
    color: string
    name: string
    dataKey: string
  }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-fg-secondary">
            {item.dataKey === "timeMs"
              ? `${item.value.toFixed(0)} ms`
              : item.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Area chart with a gradient fill and a dashed max-value reference line. */
function MemoryChart({
  title,
  data,
  color,
  maxValue,
}: {
  title: string
  data: DataPoint[]
  color: string
  maxValue: number
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={(v: number) => formatBytes(v)}
            />
            <Tooltip
              content={<ChartTooltip unit="bytes" />}
              cursor={{ stroke: "var(--color-chart-cursor)" }}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={maxValue}
              stroke="var(--color-log-error)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: "Max",
                position: "right",
                style: { fontSize: 10, fill: "var(--color-log-error)" },
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Single-series line chart with dot markers. */
function SimpleLineChart({
  title,
  data,
  color,
}: {
  title: string
  data: DataPoint[]
  color: string
}) {
  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--color-chart-cursor)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={{ r: 2, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Dual-axis line chart overlaying GC count (left axis) and GC time in ms (right axis). */
function DualAxisGcChart({ data }: { data: DualDataPoint[] }) {
  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        GC Count &amp; Time
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(v: number) => `${Math.round(v)}ms`}
            />
            <Tooltip
              content={<DualChartTooltip />}
              cursor={{ stroke: "var(--color-chart-cursor)" }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="count"
              name="GC Count"
              stroke="var(--color-fr-amber)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="timeMs"
              name="GC Time"
              stroke="var(--color-fr-coral)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Maximum number of samples retained in each metric time series. */
const MAX_SAMPLES = 30

/** Append a sample to a time series, dropping the oldest if over {@link MAX_SAMPLES}. */
function appendSample(
  arr: JvmMetricSample[],
  sample: JvmMetricSample,
): JvmMetricSample[] {
  const next = [...arr, sample]
  if (next.length > MAX_SAMPLES) return next.slice(next.length - MAX_SAMPLES)
  return next
}

/** Trigger a re-render by incrementing an internal counter. */
function useForceUpdate() {
  const [, setTick] = useState(0)
  return useCallback(() => setTick((n) => n + 1), [])
}

/**
 * Live JVM metrics dashboard with four charts.
 *
 * Initialises from the server-provided {@link JobManagerMetrics} snapshot,
 * then polls for fresh samples at the interval from {@link useConfigStore}.
 * Samples are accumulated in a ref (up to 30) to minimise state churn;
 * a force-update is triggered after each successful poll.
 */
export function JmMetricsTab({ metrics }: { metrics: JobManagerMetrics }) {
  const seriesRef = useRef<JobManagerMetrics>({ ...metrics })
  const pollIntervalMs = useConfigStore((s) => s.config?.pollIntervalMs ?? 5000)
  const forceUpdate = useForceUpdate()

  // Poll for live metrics and accumulate samples
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const m = await fetchJobManagerMetrics()
        if (cancelled) return

        const now = new Date()
        const s = seriesRef.current

        seriesRef.current = {
          jvmHeapUsed: appendSample(s.jvmHeapUsed, {
            timestamp: now,
            value: m.heapUsed,
          }),
          jvmHeapMax: m.heapMax,
          jvmNonHeapUsed: appendSample(s.jvmNonHeapUsed, {
            timestamp: now,
            value: m.nonHeapUsed,
          }),
          jvmNonHeapMax: m.nonHeapMax,
          threadCount: appendSample(s.threadCount, {
            timestamp: now,
            value: m.threadCount,
          }),
          gcCount: appendSample(s.gcCount, {
            timestamp: now,
            value: m.gcCount,
          }),
          gcTime: appendSample(s.gcTime, { timestamp: now, value: m.gcTime }),
        }
        forceUpdate()
      } catch {
        // Silently ignore poll failures
      }
    }

    const interval = setInterval(poll, pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pollIntervalMs, forceUpdate])

  const s = seriesRef.current

  const heapData = useMemo(() => toDataPoints(s.jvmHeapUsed), [s.jvmHeapUsed])
  const nonHeapData = useMemo(
    () => toDataPoints(s.jvmNonHeapUsed),
    [s.jvmNonHeapUsed],
  )
  const threadData = useMemo(() => toDataPoints(s.threadCount), [s.threadCount])
  const gcData = useMemo(
    () => toDualDataPoints(s.gcCount, s.gcTime),
    [s.gcCount, s.gcTime],
  )

  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2">
      <MemoryChart
        title="JVM Heap Used"
        data={heapData}
        color="var(--color-fr-coral)"
        maxValue={s.jvmHeapMax}
      />
      <MemoryChart
        title="JVM Non-Heap Used"
        data={nonHeapData}
        color="var(--color-fr-purple)"
        maxValue={s.jvmNonHeapMax}
      />
      <SimpleLineChart
        title="Thread Count"
        data={threadData}
        color="var(--color-fg-secondary)"
      />
      <DualAxisGcChart data={gcData} />
    </div>
  )
}
