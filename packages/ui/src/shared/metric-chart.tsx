/** Time-series metric chart — renders line/area charts for monitoring data. */
"use client"

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
import { cn } from "../lib/cn"
import type {
  MetricDataPoint,
  MetricMeta,
} from "../types"

// Rotating color palette for chart lines
const CHART_COLORS = [
  "#7aa2f7", // blue
  "#9ece6a", // green
  "#e0af68", // amber
  "#f7768e", // red/coral
  "#bb9af7", // purple
]

/** Returns a color from the rotating chart palette by index. */
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

/** Formats a raw metric value into a human-readable string using unit-aware scaling (bytes, ms, ratios, records). */
export function formatMetricValue(
  value: number | null,
  meta: MetricMeta,
): string {
  if (value === null) return "\u2014"
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
      const suffix =
        meta.type === "counter" || meta.unit === "records/s" ? "/s" : ""
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`
      if (abs >= 1000) return `${(value / 1000).toFixed(1)}K${suffix}`
      return `${value.toFixed(0)}${suffix}`
    }
    default: {
      const suffix = meta.type === "counter" ? "/s" : ""
      if (abs >= 1_000_000_000)
        return `${(value / 1_000_000_000).toFixed(1)}G${suffix}`
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`
      if (abs >= 1000) return `${(value / 1000).toFixed(1)}K${suffix}`
      return `${value.toFixed(value % 1 !== 0 ? 1 : 0)}${suffix}`
    }
  }
}

/** Returns the display label for a metric's unit badge (e.g. "rate . bytes/s", "%"). */
export function getUnitBadgeLabel(meta: MetricMeta): string {
  if (meta.type === "counter") return `rate \u00b7 ${meta.unit}/s`
  if (meta.unit === "ratio") return "%"
  return meta.unit
}

type MetricChartProps = {
  data: MetricDataPoint[]
  meta: MetricMeta
  label: string
  sourceBadge: string
  color: string
  onRemove: () => void
}

/** Recharts-based line chart panel for a single metric, with header stats, source badge, and removable card layout. */
export function MetricChart({
  data,
  meta,
  label,
  sourceBadge,
  color,
  onRemove,
}: MetricChartProps) {
  const shortName = label.split(".").slice(-2).join(".")

  const { currentValue, minValue, maxValue } = useMemo(() => {
    if (data.length === 0)
      return { currentValue: null, minValue: null, maxValue: null }
    let min = data[0].value
    let max = data[0].value
    for (const p of data) {
      if (p.value < min) min = p.value
      if (p.value > max) max = p.value
    }
    return {
      currentValue: data[data.length - 1].value,
      minValue: min,
      maxValue: max,
    }
  }, [data])

  return (
    <div className="glass-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 pb-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-zinc-200 truncate"
              title={label}
            >
              {shortName}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-zinc-800 text-zinc-400",
              )}
            >
              {sourceBadge}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-zinc-800 text-zinc-400",
              )}
            >
              {getUnitBadgeLabel(meta)}
            </span>
          </div>
          <div className="mt-0.5 text-lg font-semibold text-zinc-100">
            {formatMetricValue(currentValue, meta)}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Chart */}
      <div className="px-1 pb-1">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
          >
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTime}
              stroke="var(--color-dash-border)"
              tick={{ fill: "var(--color-fg-dim)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-dash-border)"
              tick={{ fill: "var(--color-fg-dim)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => formatMetricValue(v, meta)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-dash-panel)",
                border: "1px solid var(--color-dash-border)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--color-fg)",
              }}
              labelFormatter={formatTime}
              formatter={(value: number) => [
                formatMetricValue(value, meta),
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
        <span>Min: {formatMetricValue(minValue, meta)}</span>
        <span>Max: {formatMetricValue(maxValue, meta)}</span>
      </div>
    </div>
  )
}
