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
import type { JobManagerMetrics, JvmMetricSample } from "@/data/cluster-types";

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

type DataPoint = { time: string; value: number };

function toDataPoints(samples: JvmMetricSample[]): DataPoint[] {
  return samples.map((s) => ({
    time: format(s.timestamp, "HH:mm:ss"),
    value: s.value,
  }));
}

type DualDataPoint = { time: string; count: number; timeMs: number };

function toDualDataPoints(
  countSamples: JvmMetricSample[],
  timeSamples: JvmMetricSample[],
): DualDataPoint[] {
  return countSamples.map((s, i) => ({
    time: format(s.timestamp, "HH:mm:ss"),
    count: s.value,
    timeMs: timeSamples[i]?.value ?? 0,
  }));
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
              : unit === "ms"
                ? `${item.value.toFixed(0)} ms`
                : item.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DualChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string; dataKey: string }>;
  label?: string;
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
            {item.dataKey === "timeMs"
              ? `${item.value.toFixed(0)} ms`
              : item.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart wrappers
// ---------------------------------------------------------------------------

function MemoryChart({
  title,
  data,
  color,
  maxValue,
}: {
  title: string;
  data: DataPoint[];
  color: string;
  maxValue: number;
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`;

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
              tickFormatter={(v: number) => formatBytes(v)}
            />
            <Tooltip
              content={<ChartTooltip unit="bytes" />}
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={maxValue}
              stroke="#f7768e"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: "Max",
                position: "right",
                style: { fontSize: 10, fill: "#f7768e" },
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
  );
}

function SimpleLineChart({
  title,
  data,
  color,
}: {
  title: string;
  data: DataPoint[];
  color: string;
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
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
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
  );
}

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
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(v: number) => `${Math.round(v)}ms`}
            />
            <Tooltip
              content={<DualChartTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="count"
              name="GC Count"
              stroke="#e0af68"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="timeMs"
              name="GC Time"
              stroke="#d97085"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JmMetricsTab
// ---------------------------------------------------------------------------

export function JmMetricsTab({ metrics }: { metrics: JobManagerMetrics }) {
  const heapData = useMemo(
    () => toDataPoints(metrics.jvmHeapUsed),
    [metrics.jvmHeapUsed],
  );
  const nonHeapData = useMemo(
    () => toDataPoints(metrics.jvmNonHeapUsed),
    [metrics.jvmNonHeapUsed],
  );
  const threadData = useMemo(
    () => toDataPoints(metrics.threadCount),
    [metrics.threadCount],
  );
  const gcData = useMemo(
    () => toDualDataPoints(metrics.gcCount, metrics.gcTime),
    [metrics.gcCount, metrics.gcTime],
  );

  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2">
      <MemoryChart
        title="JVM Heap Used"
        data={heapData}
        color="#d97085"
        maxValue={metrics.jvmHeapMax}
      />
      <MemoryChart
        title="JVM Non-Heap Used"
        data={nonHeapData}
        color="#9b6bbf"
        maxValue={metrics.jvmNonHeapMax}
      />
      <SimpleLineChart
        title="Thread Count"
        data={threadData}
        color="#d4d4d8"
      />
      <DualAxisGcChart data={gcData} />
    </div>
  );
}
