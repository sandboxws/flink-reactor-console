/**
 * @module checkpoint-timeline-chart
 * Stacked bar chart showing checkpoint successes and failures over time.
 * Each bar represents a time-bucketed entry from the checkpoint analytics store.
 */
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CheckpointTimelineEntry } from "@/stores/checkpoint-analytics-store"

/** Formats a Date to locale "HH:MM" time string. */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** Custom tooltip for the timeline bar chart showing success and failure counts. */
function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs text-zinc-100">
          <span style={{ color: p.color }}>
            {p.dataKey === "successes" ? "Successes" : "Failures"}
          </span>
          : {p.value}
        </p>
      ))}
    </div>
  )
}

/**
 * Stacked bar chart visualizing checkpoint outcomes over time. Green bars
 * represent successful checkpoints and red bars represent failures, stacked
 * per time bucket. Shows a placeholder message while data is being collected.
 */
export function CheckpointTimelineChart({
  timeline,
}: {
  timeline: CheckpointTimelineEntry[]
}) {
  const chartData = timeline.map((entry) => ({
    time: formatTime(entry.timestamp),
    successes: entry.successes,
    failures: entry.failures,
  }))

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Checkpoint Timeline
      </h3>
      <div className="h-[250px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            Collecting checkpoint data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
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
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                content={<TimelineTooltip />}
                cursor={{ fill: "var(--color-chart-cursor-fill)" }}
                isAnimationActive={false}
              />
              <Bar
                dataKey="successes"
                stackId="a"
                fill="var(--color-job-running)"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="failures"
                stackId="a"
                fill="var(--color-job-failed)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
