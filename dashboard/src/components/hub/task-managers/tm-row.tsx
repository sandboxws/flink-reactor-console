/**
 * TaskManager list row — one `.tm-row` per TM in `/hub/task-managers`.
 *
 * Memory breakdown via `.resource-bar` (heap / managed / network / free)
 * computed from `tm.metrics` as a fraction of the container ceiling (Total
 * Process Memory), not the node's physical RAM. The live-dot goes amber when
 * memory pressure crosses the shared `tmMemoryHeadroom` threshold — the same
 * native-aware signal that drives the health score and the detail-page pill.
 */

import { formatBytes, type TaskManager } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { MoreVertical } from "lucide-react"
import { tmMemoryHeadroom } from "@/stores/insights-store"

/** Container ceiling (Total Process Memory) with physical-RAM fallback. */
function memoryCeiling(tm: TaskManager): number {
  const cfg = tm.memoryConfiguration
  return cfg.totalProcessMemory > 0
    ? cfg.totalProcessMemory
    : Math.max(1, tm.physicalMemory)
}

interface TmRowProps {
  tm: TaskManager
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Slice TM physical memory into heap / managed / network / free percentages. */
export function memorySegments(tm: TaskManager): {
  heapPct: number
  managedPct: number
  networkPct: number
  freePct: number
  heap: number
  managed: number
  network: number
} {
  const heap = tm.metrics.heapUsed
  const managed = tm.metrics.managedMemoryUsed
  const network = tm.metrics.nettyShuffleMemoryUsed
  const total = memoryCeiling(tm)

  const heapPct = (heap / total) * 100
  const managedPct = (managed / total) * 100
  const networkPct = (network / total) * 100
  const freePct = Math.max(0, 100 - heapPct - managedPct - networkPct)

  return { heapPct, managedPct, networkPct, freePct, heap, managed, network }
}

/** Color the live-dot by native-aware memory pressure (amber when ≥85% used). */
export function tmAlertTone(tm: TaskManager): "sage" | "amber" {
  return tmMemoryHeadroom(tm) <= 15 ? "amber" : "sage"
}

/** Color the slot-utilization sub-label by pressure threshold. */
function slotUtilTone(pct: number): string {
  if (pct >= 95) return "text-fr-amber"
  if (pct >= 80) return "text-fr-sage"
  return "text-fg-muted"
}

export function TmRow({ tm }: TmRowProps) {
  const { heapPct, managedPct, networkPct, freePct, heap, managed, network } =
    memorySegments(tm)
  const slotsUsed = tm.slotsTotal - tm.slotsFree
  const slotPct =
    tm.slotsTotal === 0 ? 0 : Math.round((slotsUsed / tm.slotsTotal) * 100)
  const tone = tmAlertTone(tm)
  const shortId = tm.id.length > 16 ? `${tm.id.slice(0, 16)}…` : tm.id

  return (
    <Link to="/hub/task-managers/$id" params={{ id: tm.id }} className="tm-row">
      <span className={tone === "amber" ? "live-dot amber" : "live-dot"} />
      <div>
        <div className="font-mono text-zinc-100 truncate">{shortId}</div>
        <div className="font-mono text-[10px] text-fg-faint truncate">
          {tm.path || `port ${tm.dataPort}`}
        </div>
      </div>
      <div>
        <div className="resource-bar mb-1">
          <div className="seg heap" style={{ width: `${heapPct}%` }} />
          <div className="seg managed" style={{ width: `${managedPct}%` }} />
          <div className="seg network" style={{ width: `${networkPct}%` }} />
          <div className="seg free" style={{ width: `${freePct}%` }} />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-fg-faint">
          <span>
            <span className="inline-block size-2 rounded-sm bg-fr-sage mr-1" />
            heap {formatBytes(heap)}
          </span>
          <span>
            <span className="inline-block size-2 rounded-sm bg-fr-amber mr-1" />
            managed {formatBytes(managed)}
          </span>
          <span>
            <span className="inline-block size-2 rounded-sm bg-fr-teal mr-1" />
            net {formatBytes(network)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[14px] text-zinc-100">
          {slotsUsed}/{tm.slotsTotal}
        </div>
        <div className={`font-mono text-[10px] ${slotUtilTone(slotPct)}`}>
          {slotPct}%
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono">{slotsUsed}</div>
      </div>
      <div className="text-right">
        <div className="font-mono">{formatBytes(network)}</div>
      </div>
      <div className="text-right font-mono text-[11px] text-fg-faint">
        {timeAgo(tm.lastHeartbeat)} ago
      </div>
      <button
        type="button"
        className="text-fg-faint hover:text-fr-coral"
        aria-label="Task manager actions"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <MoreVertical className="size-3.5" />
      </button>
    </Link>
  )
}
