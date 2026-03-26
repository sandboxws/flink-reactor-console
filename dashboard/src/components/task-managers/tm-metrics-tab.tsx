/**
 * @module tm-metrics-tab
 *
 * Live-polling time-series metrics dashboard for a single task manager.
 * Displays six charts (CPU, JVM heap, non-heap, threads, GC count, GC time)
 * that accumulate samples over time via periodic GraphQL polling. Uses refs
 * to hold sample history without triggering re-renders on every append.
 */
import { format } from "date-fns"
import { useCallback, useEffect, useRef, useState } from "react"
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
import type { TaskManager, TaskManagerMetrics } from "@flink-reactor/ui"
import { fetchTaskManagerMetrics } from "@/lib/graphql-api-client"
import { useConfigStore } from "@/stores/config-store"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maximum number of data points retained per metric series. */
const MAX_SAMPLES = 30

/** Single data point in a time-series chart. */
type DataPoint = { time: string; timestamp: number; value: number }

/** Create a {@link DataPoint} timestamped to the current instant. */
function metricToPoint(value: number): DataPoint {
  const now = Date.now()
  return {
    time: format(new Date(now), "HH:mm:ss"),
    timestamp: now,
    value,
  }
}

/** Accumulated time-series data for all six TM metric charts. */
type MetricSeries = {
  /** CPU usage percentage samples. */
  cpu: DataPoint[]
  /** JVM heap used bytes samples. */
  heap: DataPoint[]
  /** JVM non-heap used bytes samples. */
  nonHeap: DataPoint[]
  /** Active thread count samples. */
  threads: DataPoint[]
  /** Cumulative GC invocation count samples. */
  gcCount: DataPoint[]
  /** Cumulative GC time (ms) samples. */
  gcTime: DataPoint[]
  /** Current heap max for the reference line. */
  heapMax: number
}

/** Append a data point to a series, trimming to {@link MAX_SAMPLES}. */
function appendSample(series: DataPoint[], point: DataPoint): DataPoint[] {
  const next = [...series, point]
  if (next.length > MAX_SAMPLES) return next.slice(next.length - MAX_SAMPLES)
  return next
}

/** Seed a fresh {@link MetricSeries} from a snapshot of {@link TaskManagerMetrics}. */
function metricsToSeries(m: TaskManagerMetrics): MetricSeries {
  const totalGcCount = m.garbageCollectors.reduce((s, gc) => s + gc.count, 0)
  const totalGcTime = m.garbageCollectors.reduce((s, gc) => s + gc.time, 0)
  return {
    cpu: [metricToPoint(m.cpuUsage)],
    heap: [metricToPoint(m.heapUsed)],
    nonHeap: [metricToPoint(m.nonHeapUsed)],
    threads: [metricToPoint(m.threadCount)],
    gcCount: [metricToPoint(totalGcCount)],
    gcTime: [metricToPoint(totalGcTime)],
    heapMax: m.heapMax,
  }
}

/** Hook that returns a stable callback to trigger a re-render. */
function useForceUpdate() {
  const [, setTick] = useState(0)
  return useCallback(() => setTick((n) => n + 1), [])
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

/** Themed tooltip for Recharts that formats values based on unit type (bytes, pct, ms). */
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
              : unit === "pct"
                ? `${item.value.toFixed(1)}%`
                : unit === "ms"
                  ? `${item.value.toFixed(0)} ms`
                  : item.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart wrapper
// ---------------------------------------------------------------------------

/**
 * Reusable time-series chart card. Renders as an area chart when `gradient` is
 * true, otherwise a line chart. Supports an optional horizontal reference line
 * (e.g. heap max) and unit-aware axis/tooltip formatting.
 */
function MetricChart({
  title,
  data,
  color,
  unit,
  refValue,
  refLabel,
  gradient,
}: {
  title: string
  data: DataPoint[]
  color: string
  unit?: string
  refValue?: number
  refLabel?: string
  gradient?: boolean
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          {gradient ? (
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
                tickFormatter={(v: number) =>
                  unit === "bytes"
                    ? formatBytes(v)
                    : unit === "pct"
                      ? `${v.toFixed(0)}%`
                      : String(Math.round(v))
                }
              />
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ stroke: "var(--color-chart-cursor)" }}
                isAnimationActive={false}
              />
              {refValue != null && (
                <ReferenceLine
                  y={refValue}
                  stroke="var(--color-log-error)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: refLabel ?? "",
                    position: "right",
                    style: { fontSize: 10, fill: "var(--color-log-error)" },
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={`url(#${gradientId})`}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
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
                tickFormatter={(v: number) =>
                  unit === "ms" ? `${v}ms` : String(Math.round(v))
                }
              />
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ stroke: "var(--color-chart-cursor)" }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TmMetricsTab — live-polling time-series charts for CPU, memory, GC, threads
// ---------------------------------------------------------------------------

/**
 * Live metrics dashboard for a single {@link TaskManager}.
 *
 * Renders a 2-column grid of six time-series charts (CPU usage, JVM heap,
 * JVM non-heap, thread count, GC count, GC time). On mount, seeds each chart
 * with the initial metrics snapshot, then polls for fresh samples at the
 * interval configured in {@link useConfigStore}. Sample history is stored in
 * a ref to avoid re-renders during accumulation; a manual force-update is
 * triggered after each successful poll.
 */
export function TmMetricsTab({ tm }: { tm: TaskManager }) {
  const seriesRef = useRef<MetricSeries>(metricsToSeries(tm.metrics))
  const pollIntervalMs = useConfigStore((s) => s.config?.pollIntervalMs ?? 5000)
  const forceUpdate = useForceUpdate()

  // Reset series when TM changes
  useEffect(() => {
    seriesRef.current = metricsToSeries(tm.metrics)
    forceUpdate()
  }, [forceUpdate, tm.metrics]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for live metrics and accumulate samples
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const m = await fetchTaskManagerMetrics(tm.id)
        if (cancelled) return

        const s = seriesRef.current
        const totalGcCount = m.garbageCollectors.reduce(
          (acc, gc) => acc + gc.count,
          0,
        )
        const totalGcTime = m.garbageCollectors.reduce(
          (acc, gc) => acc + gc.time,
          0,
        )

        seriesRef.current = {
          cpu: appendSample(s.cpu, metricToPoint(m.cpuUsage)),
          heap: appendSample(s.heap, metricToPoint(m.heapUsed)),
          nonHeap: appendSample(s.nonHeap, metricToPoint(m.nonHeapUsed)),
          threads: appendSample(s.threads, metricToPoint(m.threadCount)),
          gcCount: appendSample(s.gcCount, metricToPoint(totalGcCount)),
          gcTime: appendSample(s.gcTime, metricToPoint(totalGcTime)),
          heapMax: m.heapMax,
        }
        forceUpdate()
      } catch {
        // Silently ignore poll failures — stale charts stay visible
      }
    }

    const interval = setInterval(poll, pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tm.id, pollIntervalMs, forceUpdate])

  const s = seriesRef.current

  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2">
      <MetricChart
        title="CPU Usage"
        data={s.cpu}
        color="var(--color-fr-coral)"
        unit="pct"
        gradient
      />
      <MetricChart
        title="JVM Heap"
        data={s.heap}
        color="var(--color-fr-coral)"
        unit="bytes"
        refValue={s.heapMax}
        refLabel="Max"
        gradient
      />
      <MetricChart
        title="JVM Non-Heap"
        data={s.nonHeap}
        color="var(--color-fr-purple)"
        unit="bytes"
        gradient
      />
      <MetricChart
        title="Thread Count"
        data={s.threads}
        color="var(--color-log-debug)"
      />
      <MetricChart
        title="GC Count"
        data={s.gcCount}
        color="var(--color-fr-amber)"
      />
      <MetricChart
        title="GC Time"
        data={s.gcTime}
        color="var(--color-fr-amber)"
        unit="ms"
      />
    </div>
  )
}
