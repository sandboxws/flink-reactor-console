/**
 * @module data-skew-tab
 *
 * Data skew analysis tab showing per-subtask record distribution for a selected
 * vertex. Renders a bar chart with a 2x-median reference line to highlight skewed
 * subtasks, plus summary statistics (total, min, max, median, avg, skew ratio).
 * Supports toggling between records-in and records-out metrics.
 */

import {
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flink-reactor/ui"
import { BarChart3 } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { JobVertex, SubtaskMetrics } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a number with SI suffixes (K, M, B) for compact chart labels. */
function formatSI(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Computes the statistical median of a numeric array. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

/** Recharts tooltip showing subtask index, record count, and skew indicator. */
function SkewTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    value: number
    payload: { subtask: string; records: number; isSkewed: boolean }
  }>
}) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="text-[10px] text-fg-muted">Subtask {data.subtask}</p>
      <p className="text-[10px] text-fg-secondary">
        {formatSI(data.records)} records
        {data.isSkewed && <span className="ml-1 text-job-failed">skewed</span>}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataSkewTab
// ---------------------------------------------------------------------------

/**
 * Data skew analysis view with vertex selector, records-in/out toggle, a bar chart
 * highlighting subtasks exceeding 2x the median (colored red), and a summary stats
 * grid. Skew ratio above 2.0x is visually flagged to draw attention to imbalances.
 */
export function DataSkewTab({
  subtaskMetrics,
  vertices,
}: {
  subtaskMetrics: Record<string, SubtaskMetrics[]>
  vertices: JobVertex[]
}) {
  const [selectedVertexId, setSelectedVertexId] = useState<string>(
    () => vertices[0]?.id ?? "",
  )
  const [metric, setMetric] = useState<"recordsIn" | "recordsOut">("recordsIn")

  const metrics = subtaskMetrics[selectedVertexId] ?? []

  const { chartData, stats } = useMemo(() => {
    const values = metrics.map((m) => m[metric])
    const med = median(values)
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const avg =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    const total = values.reduce((a, b) => a + b, 0)
    const skewRatio = med > 0 ? max / med : 0

    const data = metrics.map((m) => ({
      subtask: String(m.subtaskIndex),
      records: m[metric],
      isSkewed: med > 0 && m[metric] > 2 * med,
    }))

    return {
      chartData: data,
      stats: { total, min, max, median: med, avg, skewRatio },
    }
  }, [metrics, metric])

  if (vertices.length === 0) {
    return <EmptyState icon={BarChart3} message="No vertex data available" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <Select value={selectedVertexId} onValueChange={setSelectedVertexId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select vertex" />
          </SelectTrigger>
          <SelectContent>
            {vertices.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-dash-border">
          <button
            type="button"
            onClick={() => setMetric("recordsIn")}
            className={cn(
              "px-3 py-1 text-[11px] font-medium transition-colors",
              metric === "recordsIn"
                ? "bg-dash-elevated text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Records In
          </button>
          <button
            type="button"
            onClick={() => setMetric("recordsOut")}
            className={cn(
              "px-3 py-1 text-[11px] font-medium transition-colors",
              metric === "recordsOut"
                ? "bg-dash-elevated text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Records Out
          </button>
        </div>
      </div>

      {/* Bar chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="subtask"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Subtask Index",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 10, fill: "var(--color-fg-faint)" },
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatSI}
              width={55}
            />
            <Tooltip
              content={<SkewTooltip />}
              cursor={{ fill: "var(--color-chart-cursor-fill)" }}
              isAnimationActive={false}
            />
            {stats.median > 0 && (
              <ReferenceLine
                y={stats.median * 2}
                stroke="var(--color-job-failed)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: "2x median",
                  position: "right",
                  style: { fontSize: 10, fill: "var(--color-job-failed)" },
                }}
              />
            )}
            <Bar
              dataKey="records"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.subtask}
                  fill={
                    entry.isSkewed
                      ? "var(--color-job-failed)"
                      : "var(--color-fr-purple)"
                  }
                  fillOpacity={entry.isSkewed ? 0.8 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {[
          { label: "Total", value: formatSI(stats.total) },
          { label: "Min", value: formatSI(stats.min) },
          { label: "Max", value: formatSI(stats.max) },
          { label: "Median", value: formatSI(stats.median) },
          { label: "Avg", value: formatSI(stats.avg) },
          {
            label: "Skew Ratio",
            value: stats.skewRatio > 0 ? `${stats.skewRatio.toFixed(1)}x` : "—",
            highlight: stats.skewRatio > 2,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-card flex flex-col items-center gap-0.5 p-2"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {stat.label}
            </span>
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                "highlight" in stat && stat.highlight
                  ? "text-job-failed"
                  : "text-zinc-200",
              )}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
