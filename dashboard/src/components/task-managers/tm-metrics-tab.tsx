"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import type { TaskManager, TaskManagerMetrics } from "@/data/cluster-types";
import { fetchTaskManagerMetrics } from "@/lib/flink-api-client";
import { useConfigStore } from "@/stores/config-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const MAX_SAMPLES = 30;

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

type DataPoint = { time: string; timestamp: number; value: number };

function metricToPoint(value: number): DataPoint {
  const now = Date.now();
  return {
    time: format(new Date(now), "HH:mm:ss"),
    timestamp: now,
    value,
  };
}

type MetricSeries = {
  cpu: DataPoint[];
  heap: DataPoint[];
  nonHeap: DataPoint[];
  threads: DataPoint[];
  gcCount: DataPoint[];
  gcTime: DataPoint[];
  heapMax: number;
};

function appendSample(series: DataPoint[], point: DataPoint): DataPoint[] {
  const next = [...series, point];
  if (next.length > MAX_SAMPLES) return next.slice(next.length - MAX_SAMPLES);
  return next;
}

function metricsToSeries(m: TaskManagerMetrics): MetricSeries {
  const totalGcCount = m.garbageCollectors.reduce((s, gc) => s + gc.count, 0);
  const totalGcTime = m.garbageCollectors.reduce((s, gc) => s + gc.time, 0);
  return {
    cpu: [metricToPoint(m.cpuUsage)],
    heap: [metricToPoint(m.heapUsed)],
    nonHeap: [metricToPoint(m.nonHeapUsed)],
    threads: [metricToPoint(m.threadCount)],
    gcCount: [metricToPoint(totalGcCount)],
    gcTime: [metricToPoint(totalGcTime)],
    heapMax: m.heapMax,
  };
}

function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((n) => n + 1), []);
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
// TmMetricsTab — live-polling time-series charts for CPU, memory, GC, threads
// ---------------------------------------------------------------------------

export function TmMetricsTab({ tm }: { tm: TaskManager }) {
  const seriesRef = useRef<MetricSeries>(metricsToSeries(tm.metrics));
  const pollIntervalMs = useConfigStore((s) => s.config?.pollIntervalMs ?? 5000);
  const forceUpdate = useForceUpdate();

  // Reset series when TM changes
  useEffect(() => {
    seriesRef.current = metricsToSeries(tm.metrics);
    forceUpdate();
  }, [tm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for live metrics and accumulate samples
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const m = await fetchTaskManagerMetrics(tm.id);
        if (cancelled) return;

        const s = seriesRef.current;
        const totalGcCount = m.garbageCollectors.reduce((acc, gc) => acc + gc.count, 0);
        const totalGcTime = m.garbageCollectors.reduce((acc, gc) => acc + gc.time, 0);

        seriesRef.current = {
          cpu: appendSample(s.cpu, metricToPoint(m.cpuUsage)),
          heap: appendSample(s.heap, metricToPoint(m.heapUsed)),
          nonHeap: appendSample(s.nonHeap, metricToPoint(m.nonHeapUsed)),
          threads: appendSample(s.threads, metricToPoint(m.threadCount)),
          gcCount: appendSample(s.gcCount, metricToPoint(totalGcCount)),
          gcTime: appendSample(s.gcTime, metricToPoint(totalGcTime)),
          heapMax: m.heapMax,
        };
        forceUpdate();
      } catch {
        // Silently ignore poll failures — stale charts stay visible
      }
    };

    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tm.id, pollIntervalMs, forceUpdate]);

  const s = seriesRef.current;

  return (
    <div className="grid gap-4 pt-4 sm:grid-cols-2">
      <MetricChart
        title="CPU Usage"
        data={s.cpu}
        color="#d97085"
        unit="pct"
        gradient
      />
      <MetricChart
        title="JVM Heap"
        data={s.heap}
        color="#d97085"
        unit="bytes"
        refValue={s.heapMax}
        refLabel="Max"
        gradient
      />
      <MetricChart
        title="JVM Non-Heap"
        data={s.nonHeap}
        color="#9b6bbf"
        unit="bytes"
        gradient
      />
      <MetricChart
        title="Thread Count"
        data={s.threads}
        color="#7aa2f7"
      />
      <MetricChart
        title="GC Count"
        data={s.gcCount}
        color="#e0af68"
      />
      <MetricChart
        title="GC Time"
        data={s.gcTime}
        color="#e0af68"
        unit="ms"
      />
    </div>
  );
}
