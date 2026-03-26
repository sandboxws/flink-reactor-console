/**
 * @module log-histogram
 *
 * Stacked bar chart showing log volume over time, broken down by severity.
 * Entries are bucketed into 60 time slots spanning from the oldest visible
 * entry to now. Clicking a bar sets the time range filter in
 * {@link useFilterStore} to zoom into that bucket's time window.
 */

import { useMemo } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import type { LogEntry, LogLevel } from "@flink-reactor/ui"
import { SEVERITY_COLORS } from "@/lib/constants"
import { useFilterStore } from "@/stores/filter-store"

/** Severity levels rendered as stacked bars, ordered bottom-to-top. */
const LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]

/** Number of time buckets the histogram is divided into. */
const BUCKET_COUNT = 60

/** Custom tooltip showing per-severity counts for the hovered histogram bucket. */
function HistogramTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const items = payload.filter((p) => p.value > 0)
  if (items.length === 0) return null

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="text-fg-secondary">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

/** A single time bucket aggregating log counts by severity level. */
interface Bucket {
  /** Epoch milliseconds for the start of this bucket. */
  time: number
  /** Human-readable HH:mm label for the X axis. */
  label: string
  /** Count of TRACE-level entries in this bucket. */
  TRACE: number
  /** Count of DEBUG-level entries in this bucket. */
  DEBUG: number
  /** Count of INFO-level entries in this bucket. */
  INFO: number
  /** Count of WARN-level entries in this bucket. */
  WARN: number
  /** Count of ERROR-level entries in this bucket. */
  ERROR: number
}

/** Distributes log entries into fixed-count time buckets with per-severity counts. */
function bucketize(entries: LogEntry[]): Bucket[] {
  if (entries.length === 0) return []

  const now = Date.now()
  const oldest = entries[0].timestamp.getTime()
  const range = Math.max(now - oldest, 60_000) // at least 1 minute
  const bucketSize = range / BUCKET_COUNT

  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const t = oldest + i * bucketSize
    const d = new Date(t)
    return {
      time: t,
      label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      TRACE: 0,
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    }
  })

  for (const entry of entries) {
    const idx = Math.min(
      Math.floor((entry.timestamp.getTime() - oldest) / bucketSize),
      BUCKET_COUNT - 1,
    )
    if (idx >= 0) {
      buckets[idx][entry.level]++
    }
  }

  return buckets
}

/**
 * Log volume histogram showing entry distribution over time by severity.
 *
 * Renders a stacked bar chart with one bar per time bucket. Clicking a bar
 * sets the time range filter in {@link useFilterStore} to the clicked
 * bucket's time window, enabling quick drill-down into specific periods.
 */
export function LogHistogram({ entries }: { entries: LogEntry[] }) {
  const setTimeRange = useFilterStore((s) => s.setTimeRange)
  const data = useMemo(() => bucketize(entries), [entries])

  if (data.length === 0) return null

  const bucketSize = data.length >= 2 ? data[1].time - data[0].time : 60_000

  function handleClick(bucket: Bucket) {
    setTimeRange(new Date(bucket.time), new Date(bucket.time + bucketSize))
  }

  return (
    <div className="relative z-20 h-10 w-full border-b border-dash-border bg-dash-surface">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={1}
        >
          <XAxis dataKey="label" hide />
          <Tooltip
            content={<HistogramTooltip />}
            cursor={{ fill: "var(--color-chart-cursor-fill)" }}
            isAnimationActive={false}
            wrapperStyle={{
              opacity: 1,
              background: "none",
              border: "none",
              padding: 0,
            }}
          />
          {LEVELS.map((level) => (
            <Bar
              key={level}
              dataKey={level}
              stackId="severity"
              fill={SEVERITY_COLORS[level]}
              onClick={(_data: unknown, idx: number) => handleClick(data[idx])}
              style={{ cursor: "pointer" }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
