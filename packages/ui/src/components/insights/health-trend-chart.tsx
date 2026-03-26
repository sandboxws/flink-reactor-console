/** Health score over time chart — line chart of overall health score trend. */
"use client"

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { HealthSnapshot } from "../../types"

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-job-running)"
  if (score >= 50) return "var(--color-fr-amber)"
  return "var(--color-job-failed)"
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      <p className="text-xs font-semibold text-zinc-100">
        Score: {payload[0].value}
      </p>
    </div>
  )
}

export interface HealthTrendChartProps {
  history: HealthSnapshot[]
}

/** Area chart plotting health score snapshots over time, color-coded by current severity. */
export function HealthTrendChart({ history }: HealthTrendChartProps) {
  const data = history.map((s) => ({
    time: s.timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    score: s.score,
  }))

  const latestScore =
    history.length > 0 ? history[history.length - 1].score : 80
  const color = scoreColor(latestScore)

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Health Trend
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--color-chart-cursor)" }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke={color}
              fill="url(#healthGradient)"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
