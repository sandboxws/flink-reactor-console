import { X } from "lucide-react"
import { useMemo } from "react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/cn"
import type { MetricMeta, MetricSeries } from "@/stores/metrics-explorer-store"

// Rotating color palette for chart lines
const CHART_COLORS = [
  "#7aa2f7", // blue
  "#9ece6a", // green
  "#e0af68", // amber
  "#f7768e", // red/coral
  "#bb9af7", // purple
]

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatMetricValue(value: number | null, meta: MetricMeta): string {
  if (value === null) return "—"
  const abs = Math.abs(value)

  switch (meta.unit) {
    case "bytes":
    case "bytes/s": {
      const suffix = meta.unit === "bytes/s" ? "/s" : ""
      if (abs >= 1_073_741_824)
        return `${(value / 1_073_741_824).toFixed(1)} GB${suffix}`
      if (abs >= 1_048_576)
        return `${(value / 1_048_576).toFixed(1)} MB${suffix}`
      if (abs >= 1024) return `${(value / 1024).toFixed(1)} KB${suffix}`
      return `${value.toFixed(0)} B${suffix}`
    }
    case "ms": {
      if (abs >= 1000) return `${(value / 1000).toFixed(1)}s`
      return `${value.toFixed(0)}ms`
    }
    case "ratio": {
      return `${(value * 100).toFixed(1)}%`
    }
    case "records":
    case "records/s": {
      // Counters are already converted to /s in the poll loop
      const suffix =
        meta.type === "counter" || meta.unit === "records/s" ? "/s" : ""
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`
      if (abs >= 1000) return `${(value / 1000).toFixed(1)}K${suffix}`
      return `${value.toFixed(0)}${suffix}`
    }
    default: {
      // Counters shown as rate get /s suffix
      const suffix = meta.type === "counter" ? "/s" : ""
      if (abs >= 1_000_000_000)
        return `${(value / 1_000_000_000).toFixed(1)}G${suffix}`
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`
      if (abs >= 1000) return `${(value / 1000).toFixed(1)}K${suffix}`
      return `${value.toFixed(value % 1 !== 0 ? 1 : 0)}${suffix}`
    }
  }
}

function getUnitBadgeLabel(meta: MetricMeta): string {
  if (meta.type === "counter") return `rate \u00b7 ${meta.unit}/s`
  if (meta.unit === "ratio") return "%"
  return meta.unit
}

type MetricChartProps = {
  series: MetricSeries
  color: string
  onRemove: (seriesId: string) => void
}

export function MetricChart({ series, color, onRemove }: MetricChartProps) {
  // Short metric name (last segment)
  const shortName = series.metricName.split(".").slice(-2).join(".")

  // Compute stable tick positions rounded to clean time boundaries
  const xTicks = useMemo(() => {
    const data = series.data
    if (data.length < 2) return undefined
    const min = data[0].timestamp
    const max = data[data.length - 1].timestamp
    const range = max - min
    if (range <= 0) return undefined

    // Pick a round interval that yields 3–5 ticks
    const intervals = [
      1000, 2000, 5000, 10000, 30000, 60000, 300000, 600000, 1800000,
    ]
    const targetTicks = 4
    let step = intervals[0]
    for (const iv of intervals) {
      if (range / iv <= targetTicks + 1) {
        step = iv
        break
      }
      step = iv
    }

    // Round the first tick up to the nearest step boundary
    const firstTick = Math.ceil(min / step) * step
    const ticks: number[] = []
    for (let t = firstTick; t <= max; t += step) {
      ticks.push(t)
    }
    // If snapping produced too few ticks, fall back to evenly-spaced raw ticks
    if (ticks.length < 2) {
      const count = Math.min(targetTicks, data.length)
      const rawStep = range / (count - 1)
      ticks.length = 0
      for (let i = 0; i < count; i++) {
        ticks.push(Math.round(min + i * rawStep))
      }
    }
    return ticks
  }, [series.data])

  return (
    <div className="glass-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 pb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-zinc-200 truncate"
              title={series.metricName}
            >
              {shortName}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-zinc-800 text-zinc-400",
              )}
            >
              {series.source.type === "jm"
                ? "JM"
                : series.source.type === "tm"
                  ? "TM"
                  : "Vertex"}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-zinc-800 text-zinc-400",
              )}
            >
              {getUnitBadgeLabel(series.meta)}
            </span>
          </div>
          <div className="mt-0.5 text-lg font-semibold text-zinc-100">
            {formatMetricValue(series.currentValue, series.meta)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(series.id)}
          className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Chart */}
      <div className="px-1 pb-1">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={series.data}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
          >
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={xTicks}
              tickFormatter={formatTime}
              stroke="#3f3f46"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#3f3f46"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => formatMetricValue(v, series.meta)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelFormatter={formatTime}
              formatter={(value: number) => [
                formatMetricValue(value, series.meta),
                shortName,
              ]}
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
        </ResponsiveContainer>
      </div>

      {/* Footer — min/max */}
      <div className="flex items-center gap-3 border-t border-white/[0.04] px-3 py-1.5 text-xs text-zinc-500">
        <span>Min: {formatMetricValue(series.minValue, series.meta)}</span>
        <span>Max: {formatMetricValue(series.maxValue, series.meta)}</span>
      </div>
    </div>
  )
}
