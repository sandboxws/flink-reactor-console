"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { TaskManager } from "@/data/cluster-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function jitter(base: number, pct: number): number {
  const delta = base * pct;
  return base + (Math.random() * 2 - 1) * delta;
}

type DataPoint = { time: string; timestamp: number; value: number };

function generateSeries(
  currentValue: number,
  variance: number,
  points: number,
): DataPoint[] {
  const now = Date.now();
  const series: DataPoint[] = [];
  let value = currentValue;

  // Build backwards then reverse for chronological order
  for (let i = points - 1; i >= 0; i--) {
    const ts = now - i * 5000;
    series.push({
      time: format(new Date(ts), "HH:mm:ss"),
      timestamp: ts,
      value: Math.max(0, i === 0 ? currentValue : jitter(value, variance)),
    });
    value = series[series.length - 1].value;
  }

  return series;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border border-zinc-800 px-2 py-1.5"
      style={{ backgroundColor: "#171717" }}
    >
      <p className="mb-0.5 text-[10px] text-zinc-400">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-zinc-300">
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
  );
}

// ---------------------------------------------------------------------------
// Chart wrapper
// ---------------------------------------------------------------------------

function MetricChart({
  title,
  data,
  color,
  unit,
  refValue,
  refLabel,
  gradient,
}: {
  title: string;
  data: DataPoint[];
  color: string;
  unit?: string;
  refValue?: number;
  refLabel?: string;
  gradient?: boolean;
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`;

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          {gradient ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#52525b" }}
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
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                isAnimationActive={false}
              />
              {refValue != null && (
                <ReferenceLine
                  y={refValue}
                  stroke="#f7768e"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: refLabel ?? "",
                    position: "right",
                    style: { fontSize: 10, fill: "#f7768e" },
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
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                width={55}
                tickFormatter={(v: number) =>
                  unit === "ms" ? `${v}ms` : String(Math.round(v))
                }
              />
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
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
  );
}

// ---------------------------------------------------------------------------
// TmMetricsTab
// ---------------------------------------------------------------------------

export function TmMetricsTab({ tm }: { tm: TaskManager }) {
  const m = tm.metrics;

  const cpuData = useMemo(() => generateSeries(m.cpuUsage, 0.08, 30), [m.cpuUsage]);
  const heapData = useMemo(() => generateSeries(m.jvmHeapUsed, 0.06, 30), [m.jvmHeapUsed]);
  const nonHeapData = useMemo(() => generateSeries(m.jvmNonHeapUsed, 0.05, 30), [m.jvmNonHeapUsed]);
  const threadData = useMemo(() => generateSeries(m.threadCount, 0.04, 30), [m.threadCount]);
  const gcCountData = useMemo(() => generateSeries(m.gcCount, 0.02, 30), [m.gcCount]);
  const gcTimeData = useMemo(() => generateSeries(m.gcTime, 0.03, 30), [m.gcTime]);

  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2">
      <MetricChart
        title="CPU Usage"
        data={cpuData}
        color="#d97085"
        unit="pct"
        gradient
      />
      <MetricChart
        title="JVM Heap"
        data={heapData}
        color="#d97085"
        unit="bytes"
        refValue={m.jvmHeapMax}
        refLabel="Max"
        gradient
      />
      <MetricChart
        title="JVM Non-Heap"
        data={nonHeapData}
        color="#9b6bbf"
        unit="bytes"
        gradient
      />
      <MetricChart
        title="Thread Count"
        data={threadData}
        color="#7aa2f7"
      />
      <MetricChart
        title="GC Count"
        data={gcCountData}
        color="#e0af68"
      />
      <MetricChart
        title="GC Time"
        data={gcTimeData}
        color="#e0af68"
        unit="ms"
      />
    </div>
  );
}
