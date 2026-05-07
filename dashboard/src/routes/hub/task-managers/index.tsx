/**
 * Hub task managers list — /hub/task-managers.
 *
 * Mirrors `console-v2/task-managers.html`. Renders one `.tm-row` per
 * registered TaskManager from `useClusterStore.taskManagers` with a
 * 4-segment `.resource-bar` (heap / managed / network / free) computed
 * from the TM's metrics. Cluster-wide KPIs come from `overview`.
 *
 * Network throughput is not exposed as a per-TM rate today — the column
 * shows `nettyShuffleMemoryUsed` formatted as bytes ("net mem") rather
 * than a fake rate. Uptime falls back to lastHeartbeat-relative until a
 * dedicated start-time field exists on the TaskManager type.
 */

import {
  HubBreadcrumb,
  KpiCard,
  LiveDot,
  PropChip,
  formatBytes,
} from "@flink-reactor/ui"
import type { TaskManager } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowUpDown,
  Filter,
  MoreHorizontal,
  MoreVertical,
  Plus,
  PlusCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

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

type SortKey = "id" | "slots" | "heap" | "uptime"

/** Slice TM physical memory into heap / managed / network / free percentages. */
function memorySegments(tm: TaskManager): {
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
  const total = Math.max(1, tm.physicalMemory)

  const heapPct = (heap / total) * 100
  const managedPct = (managed / total) * 100
  const networkPct = (network / total) * 100
  const freePct = Math.max(0, 100 - heapPct - managedPct - networkPct)

  return { heapPct, managedPct, networkPct, freePct, heap, managed, network }
}

/** Color the slot-utilization sub-label by pressure threshold. */
function slotUtilTone(pct: number): string {
  if (pct >= 95) return "text-fr-amber"
  if (pct >= 80) return "text-fr-sage"
  return "text-fg-muted"
}

/** Color the live-dot by heap pressure (amber when ≥85% of physical). */
function tmAlertTone(tm: TaskManager): "sage" | "amber" {
  const heapPct = (tm.metrics.heapUsed / Math.max(1, tm.physicalMemory)) * 100
  return heapPct >= 85 ? "amber" : "sage"
}

function HubTaskManagers() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const refresh = useClusterStore((s) => s.refresh)
  const taskManagers = useClusterStore((s) => s.taskManagers)
  const overview = useClusterStore((s) => s.overview)
  const lastUpdated = useClusterStore((s) => s.lastUpdated)
  const fetchError = useClusterStore((s) => s.fetchError)

  const [filter, setFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("slots")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  const visibleTms = useMemo(() => {
    const lower = filter.toLowerCase()
    const filtered = lower
      ? taskManagers.filter(
          (tm) =>
            tm.id.toLowerCase().includes(lower) ||
            tm.path.toLowerCase().includes(lower),
        )
      : taskManagers

    const sorted = [...filtered].sort((a, b) => {
      let aV = 0
      let bV = 0
      switch (sortKey) {
        case "id":
          return sortDesc
            ? b.id.localeCompare(a.id)
            : a.id.localeCompare(b.id)
        case "slots": {
          const aPct = a.slotsTotal === 0 ? 0 : (a.slotsTotal - a.slotsFree) / a.slotsTotal
          const bPct = b.slotsTotal === 0 ? 0 : (b.slotsTotal - b.slotsFree) / b.slotsTotal
          aV = aPct
          bV = bPct
          break
        }
        case "heap":
          aV = a.metrics.heapMax === 0 ? 0 : a.metrics.heapUsed / a.metrics.heapMax
          bV = b.metrics.heapMax === 0 ? 0 : b.metrics.heapUsed / b.metrics.heapMax
          break
        case "uptime":
          aV = a.lastHeartbeat.getTime()
          bV = b.lastHeartbeat.getTime()
          break
      }
      return sortDesc ? bV - aV : aV - bV
    })
    return sorted
  }, [taskManagers, filter, sortKey, sortDesc])

  const totalHeap = useMemo(
    () => taskManagers.reduce((s, tm) => s + tm.metrics.heapMax, 0),
    [taskManagers],
  )
  const usedHeap = useMemo(
    () => taskManagers.reduce((s, tm) => s + tm.metrics.heapUsed, 0),
    [taskManagers],
  )
  const totalManaged = useMemo(
    () => taskManagers.reduce((s, tm) => s + tm.metrics.managedMemoryTotal, 0),
    [taskManagers],
  )
  const usedManaged = useMemo(
    () => taskManagers.reduce((s, tm) => s + tm.metrics.managedMemoryUsed, 0),
    [taskManagers],
  )
  const alertCount = taskManagers.filter((tm) => tmAlertTone(tm) === "amber").length

  const slotsUsedPct =
    overview && overview.totalTaskSlots > 0
      ? Math.round(
          ((overview.totalTaskSlots - overview.availableTaskSlots) /
            overview.totalTaskSlots) *
            100,
        )
      : 0
  const heapPct = totalHeap > 0 ? Math.round((usedHeap / totalHeap) * 100) : 0
  const managedPct =
    totalManaged > 0 ? Math.round((usedManaged / totalManaged) * 100) : 0

  return (
    <HubAppShell>
      {/* ── Page header ────────────────────────────────────────── */}
      <HubBreadcrumb
        crumbs={[{ label: "Cluster" }, { label: "Task managers" }]}
        LinkComponent={HubLink}
      />
      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Task managers
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {taskManagers.length} active
            {overview
              ? ` · ${overview.totalTaskSlots} total slots · ${slotsUsedPct}% utilized`
              : ""}
            {lastUpdated
              ? ` · last poll ${timeAgo(lastUpdated)} ago`
              : " · awaiting first poll"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fr-sage/10 border border-fr-sage/30 px-2.5 py-1 text-[10px] font-mono text-fr-sage">
            <LiveDot /> live
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refresh()}
            aria-label="Scale up (not implemented)"
            disabled
          >
            <Plus />
            Scale up
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="More actions"
          >
            <MoreHorizontal />
          </button>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Active TMs"
          value={taskManagers.length}
          sub={
            overview
              ? `${overview.taskManagerCount} reported by JM`
              : undefined
          }
        />
        <KpiCard
          label="Total slots"
          value={
            overview ? (
              <span>
                {overview.totalTaskSlots - overview.availableTaskSlots}{" "}
                <span className="text-[12px] text-fg-muted">
                  /{overview.totalTaskSlots}
                </span>
              </span>
            ) : (
              "—"
            )
          }
          sub={overview ? `${slotsUsedPct}% util` : undefined}
        />
        <KpiCard
          label="Heap (cluster)"
          value={
            <span>
              {formatBytes(usedHeap)}{" "}
              <span className="text-[12px] text-fg-muted">
                /{formatBytes(totalHeap)}
              </span>
            </span>
          }
          sub={`${heapPct}% allocated`}
        />
        <KpiCard
          label="Managed (cluster)"
          value={
            <span>
              {formatBytes(usedManaged)}{" "}
              <span className="text-[12px] text-fg-muted">
                /{formatBytes(totalManaged)}
              </span>
            </span>
          }
          sub={`${managedPct}% allocated`}
        />
      </section>

      {/* ── Filter chip bar ───────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-dash-border pb-3">
        <div className="relative max-w-xs flex-1">
          <Filter
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint size-4"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Filter task managers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-input mono pl-8"
            style={{ height: 30, fontSize: 12 }}
          />
        </div>
        <PropChip icon={PlusCircle}>Status</PropChip>
        <PropChip icon={PlusCircle}>Region</PropChip>
        <PropChip icon={PlusCircle}>Tier</PropChip>
        <div className="ml-auto">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDesc((v) => !v)}
            title={`Sort by ${sortKey} ${sortDesc ? "desc" : "asc"}`}
          >
            <ArrowUpDown />
            {sortKey} {sortDesc ? "desc" : "asc"}
          </button>
        </div>
      </div>

      {/* ── TM table ──────────────────────────────────────────── */}
      {fetchError ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          {fetchError}
        </div>
      ) : visibleTms.length === 0 ? (
        <div className="glass-card-static p-10 text-center text-[12px] text-fg-muted">
          {filter
            ? "No task managers match that filter."
            : "No task managers registered."}
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden">
          {/* Header row */}
          <div className="tm-row !py-2 border-b border-dash-border bg-dash-surface/40 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
            <span></span>
            <button
              type="button"
              className="text-left hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "id") setSortDesc((v) => !v)
                else {
                  setSortKey("id")
                  setSortDesc(false)
                }
              }}
            >
              TM ID
            </button>
            <span>Memory breakdown</span>
            <button
              type="button"
              className="text-right hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "slots") setSortDesc((v) => !v)
                else {
                  setSortKey("slots")
                  setSortDesc(true)
                }
              }}
            >
              Slots
            </button>
            <span className="text-right">Tasks</span>
            <span className="text-right">Net mem</span>
            <button
              type="button"
              className="text-right hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "uptime") setSortDesc((v) => !v)
                else {
                  setSortKey("uptime")
                  setSortDesc(true)
                }
              }}
            >
              Heartbeat
            </button>
            <span></span>
          </div>

          {visibleTms.map((tm) => (
            <TmRow key={tm.id} tm={tm} />
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-dash-border bg-dash-surface/40 px-4 py-2.5 text-[11px] font-mono text-fg-faint">
            <span>
              {taskManagers.length} task managers
              {overview
                ? ` · ${overview.totalTaskSlots - overview.availableTaskSlots} / ${overview.totalTaskSlots} slots`
                : ""}{" "}
              · {formatBytes(totalHeap)} heap
            </span>
            <span>
              {alertCount > 0
                ? `${alertCount} alerting · `
                : ""}
              last update {lastUpdated ? timeAgo(lastUpdated) : "—"} ago
            </span>
          </div>
        </div>
      )}
    </HubAppShell>
  )
}

function TmRow({ tm }: { tm: TaskManager }) {
  const { heapPct, managedPct, networkPct, freePct, heap, managed, network } =
    memorySegments(tm)
  const slotsUsed = tm.slotsTotal - tm.slotsFree
  const slotPct =
    tm.slotsTotal === 0 ? 0 : Math.round((slotsUsed / tm.slotsTotal) * 100)
  const tone = tmAlertTone(tm)
  const shortId = tm.id.length > 16 ? `${tm.id.slice(0, 16)}…` : tm.id

  return (
    <Link
      to="/hub/task-managers/$id"
      params={{ id: tm.id }}
      className="tm-row"
    >
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

export const Route = createFileRoute("/hub/task-managers/")({
  component: HubTaskManagers,
})
