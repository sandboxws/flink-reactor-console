import { formatBytes, formatDuration } from "@flink-reactor/ui"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/cn"
import type { JobCheckpointSummary } from "@/stores/checkpoint-analytics-store"

// Rotating palette for per-job colors
const JOB_COLORS = [
  "var(--color-fr-coral)",
  "var(--color-fr-purple)",
  "var(--color-job-running)",
  "var(--color-fr-amber)",
  "var(--color-job-finished)",
  "#e879f9", // fuchsia
  "#38bdf8", // sky
  "#a3e635", // lime
]

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

type ViewMode = "stateSize" | "duration"

// Build chart data: each checkpoint becomes a data point with per-job values
function buildChartData(
  summaries: JobCheckpointSummary[],
  mode: ViewMode,
): { data: Record<string, number | string>[]; jobNames: string[] } {
  // Collect all checkpoints with timestamps, keyed by job
  const allPoints: Array<{
    timestamp: number
    jobName: string
    value: number
  }> = []

  for (const summary of summaries) {
    for (const cp of summary.recentCheckpoints) {
      if (cp.status !== "COMPLETED") continue
      allPoints.push({
        timestamp: cp.triggerTimestamp.getTime(),
        jobName: summary.jobName,
        value: mode === "stateSize" ? cp.size : cp.duration,
      })
    }
  }

  if (allPoints.length === 0) return { data: [], jobNames: [] }

  // Group by 1-minute buckets
  const bucketMap = new Map<
    number,
    Record<string, { total: number; count: number }>
  >()
  const jobNameSet = new Set<string>()

  for (const point of allPoints) {
    const bucketTime = Math.floor(point.timestamp / 60_000) * 60_000
    jobNameSet.add(point.jobName)

    if (!bucketMap.has(bucketTime)) bucketMap.set(bucketTime, {})
    const bucket = bucketMap.get(bucketTime)!

    if (!bucket[point.jobName]) bucket[point.jobName] = { total: 0, count: 0 }
    bucket[point.jobName].total += point.value
    bucket[point.jobName].count += 1
  }

  const jobNames = Array.from(jobNameSet)

  const data = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, bucket]) => {
      const point: Record<string, number | string> = {
        time: formatTime(new Date(ts)),
      }
      for (const name of jobNames) {
        const entry = bucket[name]
        point[name] = entry ? Math.round(entry.total / entry.count) : 0
      }
      return point
    })

  return { data, jobNames }
}

function ChartTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
  mode: ViewMode
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <p key={p.dataKey} className="text-xs text-zinc-100">
            <span style={{ color: p.color }}>
              {p.dataKey.length > 20 ? `${p.dataKey.slice(0, 20)}…` : p.dataKey}
            </span>
            :{" "}
            {mode === "stateSize"
              ? formatBytes(p.value)
              : formatDuration(p.value)}
          </p>
        ))}
    </div>
  )
}

export function StateSizeChart({
  summaries,
}: {
  summaries: JobCheckpointSummary[]
}) {
  const [mode, setMode] = useState<ViewMode>("stateSize")
  const { data, jobNames } = buildChartData(summaries, mode)

  return (
    <div className="glass-card p-4">
      {/* Tab header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("stateSize")}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
              mode === "stateSize"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            State Size
          </button>
          <button
            type="button"
            onClick={() => setMode("duration")}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
              mode === "duration"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Duration Trend
          </button>
        </div>
      </div>

      <div className="h-[250px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            Collecting checkpoint data…
          </div>
        ) : mode === "stateSize" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                {jobNames.map((name, i) => (
                  <linearGradient
                    key={name}
                    id={`gradState-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={JOB_COLORS[i % JOB_COLORS.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={JOB_COLORS[i % JOB_COLORS.length]}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
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
                width={45}
                tickFormatter={formatBytes}
              />
              <Tooltip
                content={<ChartTooltip mode="stateSize" />}
                cursor={{ stroke: "var(--color-chart-cursor)" }}
                isAnimationActive={false}
              />
              {jobNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={JOB_COLORS[i % JOB_COLORS.length]}
                  fill={`url(#gradState-${i})`}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
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
                width={45}
                tickFormatter={formatDuration}
              />
              <Tooltip
                content={<ChartTooltip mode="duration" />}
                cursor={{ stroke: "var(--color-chart-cursor)" }}
                isAnimationActive={false}
              />
              {jobNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={JOB_COLORS[i % JOB_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
