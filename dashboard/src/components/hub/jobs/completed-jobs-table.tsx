/**
 * Sortable table of completed Flink jobs (FINISHED / FAILED / CANCELED /
 * SUSPENDED). Used by /hub/jobs/completed; keeps state local so callers
 * just hand it the filtered list.
 */

import type { FlinkJob } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { ArrowUpDown } from "lucide-react"
import { useMemo, useState } from "react"

interface CompletedJobsTableProps {
  jobs: FlinkJob[]
}

type SortKey = "name" | "duration" | "endTime" | "status"

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

function formatTime(date: Date | null): string {
  if (!date) return "—"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const STATUS_TONE: Record<string, string> = {
  FINISHED: "text-fr-sage",
  FAILED: "text-fr-rose",
  CANCELED: "text-fr-amber",
  SUSPENDED: "text-fg-muted",
}

export function CompletedJobsTable({ jobs }: CompletedJobsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("endTime")
  const [sortDesc, setSortDesc] = useState(true)

  const sorted = useMemo(() => {
    const copy = [...jobs]
    copy.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortKey) {
        case "name":
          av = a.name
          bv = b.name
          break
        case "duration":
          av = a.duration
          bv = b.duration
          break
        case "status":
          av = a.status
          bv = b.status
          break
        case "endTime":
          av = a.endTime?.getTime() ?? 0
          bv = b.endTime?.getTime() ?? 0
          break
      }
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
      return sortDesc ? -cmp : cmp
    })
    return copy
  }, [jobs, sortKey, sortDesc])

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDesc((v) => !v)
    else {
      setSortKey(k)
      setSortDesc(true)
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="glass-card-static p-12 text-center">
        <p className="text-[14px] font-medium text-zinc-100">
          No completed pipelines
        </p>
        <p className="mt-1 text-[12px] font-mono text-fg-muted">
          Jobs that finish, fail, or get canceled will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_120px_100px_120px] gap-3 px-3 py-2 border-b border-dash-border bg-dash-surface/40 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
        <SortHeader
          label="Pipeline"
          active={sortKey === "name"}
          desc={sortDesc}
          onClick={() => setSort("name")}
        />
        <SortHeader
          label="Status"
          active={sortKey === "status"}
          desc={sortDesc}
          onClick={() => setSort("status")}
        />
        <SortHeader
          label="Duration"
          align="right"
          active={sortKey === "duration"}
          desc={sortDesc}
          onClick={() => setSort("duration")}
        />
        <span className="text-right">Tasks</span>
        <SortHeader
          label="End time"
          align="right"
          active={sortKey === "endTime"}
          desc={sortDesc}
          onClick={() => setSort("endTime")}
        />
      </div>
      {sorted.map((job) => {
        const total = Object.values(job.tasks).reduce((s, n) => s + n, 0)
        return (
          <Link
            key={job.id}
            to="/hub/jobs/$id"
            params={{ id: job.id }}
            className="grid grid-cols-[1fr_120px_120px_100px_120px] gap-3 px-3 py-2.5 hover:bg-dash-elevated/40 border-b border-dash-border/40"
          >
            <div className="min-w-0">
              <div className="text-[12.5px] text-fg truncate">{job.name}</div>
              <div className="text-[10px] font-mono text-fg-faint truncate">
                {job.id.slice(0, 12)} · p{job.parallelism}
              </div>
            </div>
            <span
              className={`font-mono text-[11px] ${STATUS_TONE[job.status] ?? "text-fg-muted"}`}
            >
              {job.status}
            </span>
            <span className="font-mono text-[12px] text-fg text-right">
              {formatDuration(job.duration)}
            </span>
            <span className="font-mono text-[11px] text-fg-faint text-right">
              {total}
            </span>
            <span className="font-mono text-[11px] text-fg-faint text-right">
              {formatTime(job.endTime ?? job.startTime)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function SortHeader({
  label,
  active,
  desc,
  align = "left",
  onClick,
}: {
  label: string
  active: boolean
  desc: boolean
  align?: "left" | "right"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""} hover:text-fr-coral`}
      onClick={onClick}
    >
      {label}
      {active ? (
        <ArrowUpDown className={`size-3 ${desc ? "" : "rotate-180"}`} />
      ) : null}
    </button>
  )
}
