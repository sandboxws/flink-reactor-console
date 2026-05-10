/**
 * TaskManager memory breakdown card — renders the 5-segment `.resource-bar`
 * (heap / managed / network / direct / free) with per-segment usage labels
 * and the GC activity list. Mounted on the Memory tab of `/hub/task-managers/$id`.
 *
 * Percentages compute against `tm.physicalMemory` so segments sum to 100% in
 * the bar visually. Heap-tone (sage / amber / rose) keys off heap-of-max.
 */

import { formatBytes, type TaskManager } from "@flink-reactor/ui"

interface TmMemoryBarProps {
  tm: TaskManager
}

export function TmMemoryBar({ tm }: TmMemoryBarProps) {
  const heapPct =
    tm.metrics.heapMax === 0
      ? 0
      : Math.round((tm.metrics.heapUsed / tm.metrics.heapMax) * 100)

  const total = Math.max(1, tm.physicalMemory)
  const heapUsed = tm.metrics.heapUsed
  const managedUsed = tm.metrics.managedMemoryUsed
  const networkUsed = tm.metrics.nettyShuffleMemoryUsed
  const directUsed = tm.metrics.directUsed
  const heapPctP = (heapUsed / total) * 100
  const managedPctP = (managedUsed / total) * 100
  const networkPctP = (networkUsed / total) * 100
  const directPctP = (directUsed / total) * 100
  const freePctP = Math.max(
    0,
    100 - heapPctP - managedPctP - networkPctP - directPctP,
  )
  const freeBytes = Math.max(
    0,
    tm.physicalMemory - heapUsed - managedUsed - networkUsed - directUsed,
  )

  return (
    <div className="glass-card-static p-5">
      <h3 className="font-sans text-[14px] font-medium text-zinc-100 mb-4">
        Memory breakdown
      </h3>
      <div className="resource-bar mb-3" style={{ height: 18 }}>
        <div className="seg heap" style={{ width: `${heapPctP}%` }} />
        <div className="seg managed" style={{ width: `${managedPctP}%` }} />
        <div className="seg network" style={{ width: `${networkPctP}%` }} />
        <div className="seg direct" style={{ width: `${directPctP}%` }} />
        <div className="seg free" style={{ width: `${freePctP}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-5">
        <MemorySegmentLabel
          label="Heap"
          used={heapUsed}
          total={tm.metrics.heapMax}
          pct={heapPctP}
          tone={heapPct >= 90 ? "rose" : heapPct >= 75 ? "amber" : "sage"}
        />
        <MemorySegmentLabel
          label="Managed"
          used={managedUsed}
          total={tm.metrics.managedMemoryTotal}
          pct={managedPctP}
          tone="sage"
        />
        <MemorySegmentLabel
          label="Network"
          used={networkUsed}
          total={tm.metrics.nettyShuffleMemoryTotal}
          pct={networkPctP}
          tone="sage"
        />
        <MemorySegmentLabel
          label="Direct"
          used={directUsed}
          total={tm.metrics.directMax}
          pct={directPctP}
          tone="sage"
        />
        <div>
          <div className="text-[10px] text-fg-faint font-mono uppercase">
            Free
          </div>
          <div className="font-mono text-fg-muted">{formatBytes(freeBytes)}</div>
          <div className="text-[10px] text-fg-faint">
            {Math.round(freePctP)}%
          </div>
        </div>
      </div>

      <h3 className="font-sans text-[14px] font-medium text-zinc-100 mt-6 mb-3">
        GC activity
      </h3>
      {tm.metrics.garbageCollectors.length > 0 ? (
        <ul className="space-y-1.5 text-[12px]">
          {tm.metrics.garbageCollectors.map((gc) => (
            <li
              key={gc.name}
              className="flex items-center justify-between font-mono"
            >
              <span className="text-fg">{gc.name}</span>
              <span className="text-fg-muted">
                {gc.count} collections · {(gc.time / 1000).toFixed(1)}s total
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-fg-muted">No GC activity reported.</p>
      )}
    </div>
  )
}

function MemorySegmentLabel({
  label,
  used,
  total,
  pct,
  tone,
}: {
  label: string
  used: number
  total: number
  pct: number
  tone: "sage" | "amber" | "rose"
}) {
  const toneClass =
    tone === "rose"
      ? "text-fr-rose"
      : tone === "amber"
        ? "text-fr-amber"
        : "text-fr-sage"
  return (
    <div>
      <div className="text-[10px] text-fg-faint font-mono uppercase">
        {label}
      </div>
      <div className="font-mono text-zinc-100">
        {formatBytes(used)}{" "}
        <span className="text-fg-muted">/{formatBytes(total)}</span>
      </div>
      <div className={`text-[10px] font-mono ${toneClass}`}>
        {Math.round(pct)}% of physical
      </div>
    </div>
  )
}
