/**
 * Hub running pipelines — /hub/jobs/running.
 *
 * Mirrors `console-v2/jobs-running.html`. Lists all running jobs from
 * useClusterStore.runningJobs as a dense table-like list with the .pipe-row
 * grid layout from the mockup.
 *
 * Throughput / Watermark columns show "—" until `metricStream` lands; the
 * task and parallelism columns are real data today.
 */

import type { FlinkJob } from "@flink-reactor/ui"
import { HubBreadcrumb, LiveDot, PropChip } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowUpDown,
  Filter,
  Layers,
  LayoutGrid,
  MoreVertical,
  PlusCircle,
  RefreshCw,
  Settings2,
  Upload,
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
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

type SortKey = "throughput" | "name" | "parallelism" | "tasks" | "uptime"

function HubJobsRunning() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const refresh = useClusterStore((s) => s.refresh)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const lastUpdated = useClusterStore((s) => s.lastUpdated)
  const fetchError = useClusterStore((s) => s.fetchError)

  const [filter, setFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("uptime")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  const visibleJobs = useMemo(() => {
    const lower = filter.toLowerCase()
    const filtered = lower
      ? runningJobs.filter(
          (j) =>
            j.name.toLowerCase().includes(lower) ||
            j.id.toLowerCase().includes(lower),
        )
      : runningJobs

    const sorted = [...filtered].sort((a, b) => {
      let aV: number | string = 0
      let bV: number | string = 0
      switch (sortKey) {
        case "name":
          aV = a.name
          bV = b.name
          break
        case "parallelism":
          aV = a.parallelism
          bV = b.parallelism
          break
        case "tasks":
          aV = Object.values(a.tasks).reduce((s, n) => s + n, 0)
          bV = Object.values(b.tasks).reduce((s, n) => s + n, 0)
          break
        case "uptime":
          aV = a.startTime.getTime()
          bV = b.startTime.getTime()
          break
        case "throughput":
          // No real-time throughput yet — fall back to uptime to keep stable
          aV = a.startTime.getTime()
          bV = b.startTime.getTime()
          break
      }
      const cmp =
        typeof aV === "number" && typeof bV === "number"
          ? aV - bV
          : String(aV).localeCompare(String(bV))
      return sortDesc ? -cmp : cmp
    })
    return sorted
  }, [runningJobs, filter, sortKey, sortDesc])

  const warningCount = runningJobs.filter(
    (j) => j.status === "RESTARTING" || j.status === "RECONCILING",
  ).length
  const failedCount = runningJobs.filter((j) => j.status === "FAILING").length

  return (
    <HubAppShell>
      {/* ── Page header ────────────────────────────────────────── */}
      <HubBreadcrumb
        crumbs={[{ label: "Pipelines" }]}
        LinkComponent={HubLink}
      />
      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Running pipelines
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {runningJobs.length} running
            {warningCount > 0 ? ` · ${warningCount} warning` : ""}
            {failedCount > 0 ? ` · ${failedCount} failing` : ""}
            {lastUpdated
              ? ` · last poll ${timeAgo(lastUpdated)} ago`
              : " · awaiting first poll"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fr-sage/10 border border-fr-sage/30 px-2.5 py-1 text-[10px] font-mono text-fr-sage">
            <LiveDot /> live · 5s
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refresh()}
          >
            <RefreshCw />
            Refresh
          </button>
          <Link to="/hub/jobs/submit" className="btn btn-primary btn-sm">
            <Upload />
            Submit pipeline
          </Link>
        </div>
      </div>

      {/* ── Filter chip bar ────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-dash-border pb-3">
        <div className="relative max-w-xs flex-1">
          <Filter
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint size-4"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Filter pipelines..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-input mono pl-8"
            style={{ height: 30, fontSize: 12 }}
          />
        </div>
        <PropChip icon={PlusCircle}>Status</PropChip>
        <PropChip icon={PlusCircle}>Owner</PropChip>
        <PropChip icon={PlusCircle}>Throughput</PropChip>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDesc((v) => !v)}
            title={`Sort by ${sortKey} ${sortDesc ? "desc" : "asc"}`}
          >
            <ArrowUpDown />
            {sortKey} {sortDesc ? "desc" : "asc"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="Grid view (coming soon)"
          >
            <LayoutGrid />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="View settings (coming soon)"
          >
            <Settings2 />
          </button>
        </div>
      </div>

      {/* ── Pipeline table ────────────────────────────────────── */}
      {fetchError ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          {fetchError}
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="glass-card-static p-10 text-center text-[12px] text-fg-muted">
          {filter ? "No pipelines match that filter." : "No running pipelines."}
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden">
          {/* Header row */}
          <div className="pipe-row !py-2 border-b border-dash-border bg-dash-surface/40 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
            <span></span>
            <button
              type="button"
              className="text-left hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "name") setSortDesc((v) => !v)
                else {
                  setSortKey("name")
                  setSortDesc(false)
                }
              }}
            >
              Pipeline
            </button>
            <span>Status</span>
            <span className="text-right">Throughput</span>
            <span className="text-right">Watermark</span>
            <button
              type="button"
              className="text-left hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "tasks") setSortDesc((v) => !v)
                else {
                  setSortKey("tasks")
                  setSortDesc(true)
                }
              }}
            >
              Tasks
            </button>
            <button
              type="button"
              className="text-right hover:text-fr-coral"
              onClick={() => {
                if (sortKey === "parallelism") setSortDesc((v) => !v)
                else {
                  setSortKey("parallelism")
                  setSortDesc(true)
                }
              }}
            >
              p
            </button>
            <span></span>
          </div>

          {visibleJobs.map((job) => (
            <PipelineRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </HubAppShell>
  )
}

function PipelineRow({ job }: { job: FlinkJob }) {
  const totalTasks = Object.values(job.tasks).reduce((s, n) => s + n, 0)
  const allRunning = job.tasks.running === totalTasks && totalTasks > 0
  return (
    <Link to="/hub/jobs/$id" params={{ id: job.id }} className="pipe-row">
      <Layers className="size-4 text-fr-coral shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-100 truncate">{job.name}</span>
          <span className="font-mono text-[10px] text-fg-faint">
            {job.id.slice(0, 8)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] font-mono text-fg-faint">
          <span>up {timeAgo(job.startTime)}</span>
          <span>·</span>
          <span className="text-fr-sage">started</span>
        </div>
      </div>
      <span className="status-pill running">
        <LiveDot />
        {job.status === "RUNNING"
          ? "Running"
          : job.status.charAt(0) + job.status.slice(1).toLowerCase()}
      </span>
      <div className="text-right">
        <div className="font-mono text-[14px] text-zinc-100">—</div>
        <div className="font-mono text-[10px] text-fg-muted">evt/s</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] text-fg">—</div>
        <div className="font-mono text-[10px] text-fg-faint">p99</div>
      </div>
      <div>
        <div className="text-[12px] text-fg">
          {job.tasks.running}{" "}
          <span className="text-fg-faint">/{totalTasks}</span>
        </div>
        <div
          className={`font-mono text-[10px] ${allRunning ? "text-fr-sage" : "text-fr-amber"}`}
        >
          {allRunning
            ? "all running"
            : `${totalTasks - job.tasks.running} not ready`}
        </div>
      </div>
      <span className="font-mono text-[12px] text-fg-muted text-right">
        {job.parallelism}
      </span>
      <button
        type="button"
        className="text-fg-faint hover:text-fr-coral"
        aria-label="Pipeline actions"
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

export const Route = createFileRoute("/hub/jobs/running")({
  component: HubJobsRunning,
})
