"use client";

import { X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { MetricSeries } from "@/stores/metrics-explorer-store";
import { cn } from "@/lib/cn";

// Rotating color palette for chart lines
const CHART_COLORS = [
  "#7aa2f7", // blue
  "#9ece6a", // green
  "#e0af68", // amber
  "#f7768e", // red/coral
  "#bb9af7", // purple
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatValue(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}G`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(value % 1 !== 0 ? 1 : 0);
}

type MetricChartProps = {
  series: MetricSeries;
  color: string;
  onRemove: (seriesId: string) => void;
};

export function MetricChart({ series, color, onRemove }: MetricChartProps) {
  // Short metric name (last segment)
  const shortName = series.metricName.split(".").slice(-2).join(".");

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
          </div>
          <div className="mt-0.5 text-lg font-semibold text-zinc-100">
            {formatValue(series.currentValue)}
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
              tickFormatter={formatTime}
              stroke="#3f3f46"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={60}
            />
            <YAxis
              stroke="#3f3f46"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatValue(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelFormatter={formatTime}
              formatter={(value: number) => [formatValue(value), shortName]}
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
        <span>Min: {formatValue(series.minValue)}</span>
        <span>Max: {formatValue(series.maxValue)}</span>
      </div>
    </div>
  );
}
