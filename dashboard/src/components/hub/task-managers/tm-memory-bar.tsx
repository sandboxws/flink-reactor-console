/**
 * TaskManager memory breakdown card — renders the 5-segment `.resource-bar`
 * (heap / managed / network / direct / unused) with per-segment usage labels
 * and the GC activity list. Mounted on the Memory tab of `/hub/task-managers/$id`.
 *
 * Percentages compute against `tm.memoryConfiguration.totalProcessMemory` — the
 * container ceiling the OOMKiller actually enforces — not the node's physical
 * RAM (which is usually far larger and made every pool look tiny). Each pool is
 * toned by its OWN saturation, so a filling managed/RocksDB pool goes amber/rose
 * even while heap looks calm — the exact signal the "Flink OOMKills" article
 * says heap-only dashboards miss. The header pill shows the shared
 * `tmMemoryHeadroom` pressure (health score / list dot / issue feed all agree).
 */

import { formatBytes, type TaskManager } from "@flink-reactor/ui"
import { tmMemoryHeadroom } from "@/stores/insights-store"

interface TmMemoryBarProps {
  tm: TaskManager
}

type PoolTone = "sage" | "amber" | "rose"

/** Tone a pool by how full it is relative to its OWN configured/observed max. */
function poolTone(used: number, total: number): PoolTone {
  if (total <= 0) return "sage"
  const pct = (used / total) * 100
  return pct >= 90 ? "rose" : pct >= 75 ? "amber" : "sage"
}

export function TmMemoryBar({ tm }: TmMemoryBarProps) {
  const cfg = tm.memoryConfiguration
  // Container ceiling (Total Process Memory) with physical-RAM fallback.
  const ceilingIsLimit = cfg.totalProcessMemory > 0
  const ceiling = ceilingIsLimit
    ? cfg.totalProcessMemory
    : Math.max(1, tm.physicalMemory)
  const denomLabel = ceilingIsLimit ? "of limit" : "of physical"

  const heapUsed = tm.metrics.heapUsed
  const managedUsed = tm.metrics.managedMemoryUsed
  const networkUsed = tm.metrics.nettyShuffleMemoryUsed
  const directUsed = tm.metrics.directUsed

  const heapPctP = (heapUsed / ceiling) * 100
  const managedPctP = (managedUsed / ceiling) * 100
  const networkPctP = (networkUsed / ceiling) * 100
  const directPctP = (directUsed / ceiling) * 100
  const unusedPctP = Math.max(
    0,
    100 - heapPctP - managedPctP - networkPctP - directPctP,
  )
  const unusedBytes = Math.max(
    0,
    ceiling - heapUsed - managedUsed - networkUsed - directUsed,
  )

  // Health-relevant pressure — shared with the list-row dot, the issue feed,
  // and the cluster health score (see tmMemoryHeadroom).
  const headroom = tmMemoryHeadroom(tm)
  const headroomTone = headroom <= 10 ? "fail" : headroom <= 25 ? "warn" : "ok"

  return (
    <div className="glass-card-static p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-sans text-[14px] font-medium text-zinc-100">
          Memory breakdown
        </h3>
        <span className={`sev-badge ${headroomTone}`}>
          {headroom}% headroom
        </span>
      </div>
      <div className="resource-bar mb-2" style={{ height: 18 }}>
        <div className="seg heap" style={{ width: `${heapPctP}%` }} />
        <div className="seg managed" style={{ width: `${managedPctP}%` }} />
        <div className="seg network" style={{ width: `${networkPctP}%` }} />
        <div className="seg direct" style={{ width: `${directPctP}%` }} />
        <div className="seg free" style={{ width: `${unusedPctP}%` }} />
      </div>
      <p className="mb-3 text-[10px] text-fg-faint">
        Flink-visible pools vs container limit · excludes native (RocksDB)
        memory
      </p>
      <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-5">
        <MemorySegmentLabel
          label="Heap"
          used={heapUsed}
          total={tm.metrics.heapMax}
          pct={heapPctP}
          denomLabel={denomLabel}
          tone={poolTone(heapUsed, tm.metrics.heapMax)}
        />
        <MemorySegmentLabel
          label="Managed"
          used={managedUsed}
          total={tm.metrics.managedMemoryTotal}
          pct={managedPctP}
          denomLabel={denomLabel}
          tone={poolTone(managedUsed, tm.metrics.managedMemoryTotal)}
        />
        <MemorySegmentLabel
          label="Network"
          used={networkUsed}
          total={tm.metrics.nettyShuffleMemoryTotal}
          pct={networkPctP}
          denomLabel={denomLabel}
          tone={poolTone(networkUsed, tm.metrics.nettyShuffleMemoryTotal)}
        />
        <MemorySegmentLabel
          label="Direct"
          used={directUsed}
          total={tm.metrics.directMax}
          pct={directPctP}
          denomLabel={denomLabel}
          tone={poolTone(directUsed, tm.metrics.directMax)}
        />
        <div>
          <div className="text-[10px] text-fg-faint font-mono uppercase">
            Unused
          </div>
          <div className="font-mono text-fg-muted">
            {formatBytes(unusedBytes)}
          </div>
          <div className="text-[10px] text-fg-faint">
            {Math.round(unusedPctP)}% {denomLabel}
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
  denomLabel,
  tone,
}: {
  label: string
  used: number
  total: number
  pct: number
  denomLabel: string
  tone: PoolTone
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
        {Math.round(pct)}% {denomLabel}
      </div>
    </div>
  )
}
