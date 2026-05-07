/**
 * Cluster resource pressure bars (CPU / heap / network / disk) using the
 * `.resource-bar` primitive. Each gauge renders the live value plus its
 * fraction of capacity. Driven by `useClusterStore` task-manager data.
 */

import type { TaskManager } from "@flink-reactor/ui"

interface Gauge {
  label: string
  value: string
  pct: number
  /** Tone toggle when value enters the warn band (e.g. heap > 85%). */
  warn?: boolean
  variant: "heap" | "managed" | "network"
}

interface ResourceGaugesProps {
  taskManagers: TaskManager[]
}

export function ResourceGauges({ taskManagers }: ResourceGaugesProps) {
  const gauges = computeGauges(taskManagers)
  return (
    <div className="space-y-3 text-[12px]">
      {gauges.map((g) => (
        <div key={g.label}>
          <div className="flex items-center justify-between mb-1">
            <span className={g.warn ? "text-fr-amber" : "text-fg-muted"}>
              {g.label}
            </span>
            <span
              className={`font-mono ${g.warn ? "text-fr-amber" : "text-zinc-100"}`}
            >
              {g.value}
            </span>
          </div>
          <div className="resource-bar">
            <div
              className={`seg ${g.variant}`}
              style={{ width: `${Math.min(100, g.pct)}%` }}
            />
            <div
              className="seg free"
              style={{ width: `${Math.max(0, 100 - g.pct)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function computeGauges(tms: TaskManager[]): Gauge[] {
  if (tms.length === 0) {
    return [
      { label: "Heap (cluster avg)", value: "—", pct: 0, variant: "heap" },
      {
        label: "Managed memory (cluster avg)",
        value: "—",
        pct: 0,
        variant: "managed",
      },
      { label: "Network", value: "—", pct: 0, variant: "network" },
    ]
  }

  let heapUsed = 0
  let heapMax = 0
  let mngUsed = 0
  let mngMax = 0
  let worstHeapPct = 0
  let worstHeapTm = ""

  for (const tm of tms) {
    const m = tm.metrics
    if (!m) continue
    heapUsed += m.heapUsed
    heapMax += m.heapMax
    mngUsed += m.managedMemoryUsed ?? 0
    mngMax += m.managedMemoryTotal ?? 0
    if (m.heapMax > 0) {
      const pct = (m.heapUsed / m.heapMax) * 100
      if (pct > worstHeapPct) {
        worstHeapPct = pct
        worstHeapTm = tm.id
      }
    }
  }

  const heapPct = heapMax > 0 ? (heapUsed / heapMax) * 100 : 0
  const mngPct = mngMax > 0 ? (mngUsed / mngMax) * 100 : 0

  const gauges: Gauge[] = [
    {
      label: "Heap (cluster avg)",
      value: `${heapPct.toFixed(0)}%`,
      pct: heapPct,
      variant: "heap",
    },
    {
      label: "Managed memory (cluster avg)",
      value: `${mngPct.toFixed(0)}%`,
      pct: mngPct,
      variant: "managed",
    },
    {
      label: "Active task managers",
      value: `${tms.length} online`,
      pct: 100,
      variant: "network",
    },
  ]

  if (worstHeapPct >= 85) {
    gauges.push({
      label: `Heap (${worstHeapTm.slice(0, 16)} worst)`,
      value: `${worstHeapPct.toFixed(0)}%`,
      pct: worstHeapPct,
      warn: true,
      variant: "heap",
    })
  }

  return gauges
}
