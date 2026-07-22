/**
 * TaskManager memory trend — a stacked area chart of the Flink-visible memory
 * pools (heap / managed / network / direct / metaspace) over the last hour,
 * backfilled from the persisted metric history, with a dashed reference line at
 * the container ceiling (Total Process Memory).
 *
 * This is the time dimension of the OOMKills story: a single snapshot hides a
 * slow climb, but a stack creeping toward the ceiling — and *which* pool is
 * doing the creeping (managed = RocksDB) — is exactly the leak fingerprint the
 * "Flink OOMKills" article says heap-only views miss. Data comes from the
 * TimescaleDB-backed `metricSeries` API, so history shows immediately rather
 * than only accumulating from the current session.
 */

import { formatBytes, type TaskManager } from "@flink-reactor/ui"
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { fetchMetricSeries } from "@/lib/graphql-api-client"
import { useConfigStore } from "@/stores/config-store"

interface TmMemoryTrendProps {
  tm: TaskManager
}

type MemoryPool = "heap" | "managed" | "network" | "direct" | "metaspace"

type TrendRow = { t: number } & Record<MemoryPool, number>

/** The stacked pools, in draw order, with their metric id, label, and token color. */
const POOLS: {
  key: MemoryPool
  metricID: string
  label: string
  color: string
}[] = [
  {
    key: "heap",
    metricID: "Status.JVM.Memory.Heap.Used",
    label: "Heap",
    color: "var(--color-fr-sage)",
  },
  {
    key: "managed",
    metricID: "Status.Flink.Memory.Managed.Used",
    label: "Managed",
    color: "var(--color-fr-amber)",
  },
  {
    key: "network",
    metricID: "Status.Shuffle.Netty.UsedMemory",
    label: "Network",
    color: "var(--color-fr-teal)",
  },
  {
    key: "direct",
    metricID: "Status.JVM.Memory.Direct.MemoryUsed",
    label: "Direct",
    color: "var(--color-fr-purple)",
  },
  {
    key: "metaspace",
    metricID: "Status.JVM.Memory.Metaspace.Used",
    label: "Metaspace",
    color: "var(--color-fr-coral)",
  },
]

const WINDOW_MS = 60 * 60 * 1000
const REFRESH_MS = 30_000
const BUCKET_MS = 5_000
const TOKEN_AXIS = "var(--color-fg-faint)"

/**
 * Merge the per-metric series into stacked rows keyed by a 5s time bucket, so
 * the five pools captured in one sync tick line up into a single stacked row
 * even if their `capturedAt` timestamps differ by milliseconds.
 */
function mergeSeries(
  series: Awaited<ReturnType<typeof fetchMetricSeries>>,
): TrendRow[] {
  const byMetric = new Map<string, MemoryPool>(
    POOLS.map((p) => [p.metricID, p.key] as const),
  )
  const rows = new Map<number, TrendRow>()
  for (const s of series) {
    const key = byMetric.get(s.metricID)
    if (!key) continue
    for (const p of s.points) {
      const t = Math.round(Date.parse(p.capturedAt) / BUCKET_MS) * BUCKET_MS
      let row = rows.get(t)
      if (!row) {
        row = { t, heap: 0, managed: 0, network: 0, direct: 0, metaspace: 0 }
        rows.set(t, row)
      }
      row[key] = p.value
    }
  }
  return Array.from(rows.values()).sort((a, b) => a.t - b.t)
}

export function TmMemoryTrend({ tm }: TmMemoryTrendProps) {
  const clusterID = useConfigStore((s) => s.config?.clusters?.[0] ?? "default")
  const [data, setData] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const now = Date.now()
        const series = await fetchMetricSeries({
          clusterID,
          series: POOLS.map((p) => ({
            sourceType: "task_manager",
            sourceID: tm.id,
            metricID: p.metricID,
          })),
          after: new Date(now - WINDOW_MS).toISOString(),
          before: new Date(now).toISOString(),
          maxPoints: 240,
        })
        if (cancelled) return
        setData(mergeSeries(series))
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load trend")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [clusterID, tm.id])

  const ceiling = tm.memoryConfiguration.totalProcessMemory

  return (
    <div className="glass-card-static p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-sans text-[14px] font-medium text-zinc-100">
          Memory trend (1h)
        </h3>
        <span className="font-mono text-[10px] text-fg-faint">
          Flink-visible pools · stacked vs container limit
        </span>
      </div>
      {loading && data.length === 0 ? (
        <p className="py-12 text-center font-mono text-[12px] text-fg-muted">
          Loading history…
        </p>
      ) : error ? (
        <p className="py-12 text-center font-mono text-[12px] text-fr-rose">
          {error}
        </p>
      ) : data.length === 0 ? (
        <p className="py-12 text-center font-mono text-[12px] text-fg-muted">
          No persisted history yet — samples are still being collected.
        </p>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
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
                width={52}
                tick={{ fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) => formatBytes(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-dash-panel)",
                  borderColor: "var(--color-dash-border)",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                labelFormatter={(t: number) => new Date(t).toLocaleString()}
                formatter={(value) => formatBytes(Number(value))}
              />
              <Legend
                wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
              />
              {POOLS.map((p) => (
                <Area
                  key={p.key}
                  type="monotone"
                  dataKey={p.key}
                  name={p.label}
                  stackId="mem"
                  stroke={p.color}
                  fill={p.color}
                  fillOpacity={0.22}
                  strokeWidth={1.4}
                  isAnimationActive={false}
                />
              ))}
              {ceiling > 0 ? (
                <ReferenceLine
                  y={ceiling}
                  stroke="var(--color-fr-rose)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.85}
                  label={{
                    value: `limit ${formatBytes(ceiling)}`,
                    position: "insideTopRight",
                    fill: "var(--color-fr-rose)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
