/**
 * Metrics canvas — main Recharts area-chart wrapper for the Hub metrics
 * explorer. The legacy job-detail tabs already use Recharts; this wrapper
 * applies FR token theming (axis colors, gridlines, tooltip backgrounds)
 * so the chart matches the rest of the Hub.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface MetricPoint {
  t: number
  v: number
}

interface MetricsCanvasProps {
  data: MetricPoint[]
  color?: string
  height?: number
}

const TOKEN_GRID = "rgba(212,190,152,0.08)"
const TOKEN_AXIS = "var(--color-fg-faint)"
const TOKEN_TOOLTIP_BG = "var(--color-dash-panel)"
const TOKEN_TOOLTIP_BORDER = "var(--color-dash-border)"

export function MetricsCanvas({
  data,
  color = "var(--color-fr-sage)",
  height = 280,
}: MetricsCanvasProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <defs>
            <linearGradient id="metric-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={TOKEN_GRID} vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: number) =>
              new Date(t).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            stroke={TOKEN_AXIS}
            fontSize={10}
            tick={{ fontFamily: "var(--font-mono)" }}
          />
          <YAxis
            stroke={TOKEN_AXIS}
            fontSize={10}
            tick={{ fontFamily: "var(--font-mono)" }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: TOKEN_TOOLTIP_BG,
              borderColor: TOKEN_TOOLTIP_BORDER,
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            labelFormatter={(t: number) => new Date(t).toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill="url(#metric-fill)"
            strokeWidth={1.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export type { MetricPoint }
