/**
 * @module error-timeline
 *
 * Bar chart visualizing error occurrence frequency over time for a single
 * {@link ErrorGroup}. Occurrence timestamps are bucketed into 30 time slots
 * spanning from the first to the last occurrence, providing a quick view
 * of whether the error is steady, bursty, or trending.
 */

import { useMemo } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"

/** Number of time buckets in the timeline chart. */
const BUCKET_COUNT = 30

/** A single time bucket aggregating error occurrence counts. */
interface Bucket {
  /** Epoch milliseconds for the start of this bucket. */
  time: number
  /** Human-readable HH:mm label for the X axis. */
  label: string
  /** Number of error occurrences in this bucket. */
  count: number
}

/** Distributes occurrence timestamps into fixed-count time buckets. */
function bucketize(occurrences: Date[]): Bucket[] {
  if (occurrences.length === 0) return []

  const min = occurrences[0].getTime()
  const max = occurrences[occurrences.length - 1].getTime()
  const range = Math.max(max - min, 60_000) // at least 1 minute
  const bucketSize = range / BUCKET_COUNT

  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const t = min + i * bucketSize
    const d = new Date(t)
    return {
      time: t,
      label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      count: 0,
    }
  })

  for (const d of occurrences) {
    const idx = Math.min(
      Math.floor((d.getTime() - min) / bucketSize),
      BUCKET_COUNT - 1,
    )
    if (idx >= 0) {
      buckets[idx].count++
    }
  }

  return buckets
}

/**
 * Error occurrence timeline chart.
 *
 * Renders a Recharts bar chart showing how an error group's occurrences
 * are distributed over time. The time range spans from the first to the
 * last occurrence, divided into {@link BUCKET_COUNT} equal intervals.
 * Returns `null` when there are no occurrences to display.
 */
export function ErrorTimeline({ occurrences }: { occurrences: Date[] }) {
  const data = useMemo(() => bucketize(occurrences), [occurrences])

  if (data.length === 0) return null

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
          barCategoryGap={2}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "var(--color-fg-faint)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-dash-panel)",
              border: "1px solid var(--color-dash-border)",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 8px",
            }}
            itemStyle={{
              padding: 0,
              fontSize: 10,
              color: "var(--color-log-error)",
            }}
            labelStyle={{ color: "var(--color-fg-muted)", fontSize: 10 }}
            cursor={{ fill: "var(--color-chart-cursor-fill)" }}
          />
          <Bar
            dataKey="count"
            fill="var(--color-log-error)"
            radius={[2, 2, 0, 0]}
            name="Occurrences"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
