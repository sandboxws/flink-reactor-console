/**
 * @module checkpoint-job-table
 * Sortable table of per-job checkpoint statistics including success rate,
 * average duration, state size, and trend indicators. Supports column sorting
 * by all numeric and trend fields.
 */
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { formatBytes, formatDuration } from "@flink-reactor/ui"
import { useState } from "react"
import { cn } from "@/lib/cn"
import type {
  JobCheckpointSummary,
  TrendDirection,
} from "@/stores/checkpoint-analytics-store"

/** Formats a millisecond interval as a human-readable string (e.g. "5min", "30s"). */
function formatInterval(ms: number): string {
  if (ms >= 60_000) return `${ms / 60_000}min`
  return `${ms / 1000}s`
}

/** Formats a date as a locale time string, returning "---" for null. */
function formatTime(date: Date | null): string {
  if (!date) return "—"
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Renders a colored directional arrow indicating an increasing, decreasing, or stable trend. */
function TrendIndicator({ trend }: { trend: TrendDirection }) {
  if (trend === "increasing") {
    return <ArrowUp className="size-3.5 text-job-failed" />
  }
  if (trend === "decreasing") {
    return <ArrowDown className="size-3.5 text-job-running" />
  }
  return <ArrowRight className="size-3.5 text-zinc-500" />
}

/** Columns available for sorting in the checkpoint job table. */
type SortKey =
  | "jobName"
  | "lastSuccessTime"
  | "checkpointInterval"
  | "avgDuration"
  | "totalStateSize"
  | "successRate"
  | "durationTrend"
  | "stateSizeTrend"

type SortDir = "asc" | "desc"

/** Numeric ordering for trend comparisons (decreasing < stable < increasing). */
const TREND_ORDER: Record<TrendDirection, number> = {
  increasing: 2,
  stable: 1,
  decreasing: 0,
}

/** Sorts an array of job checkpoint summaries by the given column and direction. */
function sortSummaries(
  summaries: JobCheckpointSummary[],
  key: SortKey,
  dir: SortDir,
): JobCheckpointSummary[] {
  return [...summaries].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case "jobName":
        cmp = a.jobName.localeCompare(b.jobName)
        break
      case "lastSuccessTime":
        cmp =
          (a.lastSuccessTime?.getTime() ?? 0) -
          (b.lastSuccessTime?.getTime() ?? 0)
        break
      case "checkpointInterval":
        cmp = a.checkpointInterval - b.checkpointInterval
        break
      case "avgDuration":
        cmp = a.avgDuration - b.avgDuration
        break
      case "totalStateSize":
        cmp = a.totalStateSize - b.totalStateSize
        break
      case "successRate":
        cmp = a.successRate - b.successRate
        break
      case "durationTrend":
        cmp = TREND_ORDER[a.durationTrend] - TREND_ORDER[b.durationTrend]
        break
      case "stateSizeTrend":
        cmp = TREND_ORDER[a.stateSizeTrend] - TREND_ORDER[b.stateSizeTrend]
        break
    }
    return dir === "asc" ? cmp : -cmp
  })
}

/** Clickable column header that shows a sort direction chevron when active. */
function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = sortKey === currentKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors",
        className,
      )}
    >
      {label}
      {isActive &&
        (currentDir === "asc" ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        ))}
    </button>
  )
}

/**
 * Sortable table showing per-job checkpoint metrics: last success time,
 * checkpoint interval, average duration, state size, success rate, and
 * trend arrows for duration and state size. Defaults to ascending sort
 * by success rate to surface struggling jobs first.
 */
export function CheckpointJobTable({
  summaries,
}: {
  summaries: JobCheckpointSummary[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>("successRate")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = sortSummaries(summaries, sortKey, sortDir)

  if (summaries.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center p-8 text-sm text-zinc-500">
        No checkpoint data available
      </div>
    )
  }

  const headerProps = {
    currentKey: sortKey,
    currentDir: sortDir,
    onSort: handleSort,
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-3 py-2.5 text-left">
                <SortHeader
                  label="Job Name"
                  sortKey="jobName"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-left">
                <SortHeader
                  label="Last Success"
                  sortKey="lastSuccessTime"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="Interval"
                  sortKey="checkpointInterval"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="Avg Duration"
                  sortKey="avgDuration"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="State Size"
                  sortKey="totalStateSize"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="Success Rate"
                  sortKey="successRate"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-center">
                <SortHeader
                  label="Duration"
                  sortKey="durationTrend"
                  {...headerProps}
                />
              </th>
              <th className="px-3 py-2.5 text-center">
                <SortHeader
                  label="Size"
                  sortKey="stateSizeTrend"
                  {...headerProps}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.jobId}
                className="border-b border-dash-border/50 transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2 font-medium text-zinc-200 max-w-48 truncate">
                  {s.jobName}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {formatTime(s.lastSuccessTime)}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {s.checkpointInterval > 0
                    ? formatInterval(s.checkpointInterval)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300">
                  {formatDuration(s.avgDuration)}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300">
                  {formatBytes(s.totalStateSize)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      s.successRate > 95
                        ? "text-job-running"
                        : s.successRate > 80
                          ? "text-fr-amber"
                          : "text-job-failed",
                    )}
                  >
                    {s.successRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <TrendIndicator trend={s.durationTrend} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <TrendIndicator trend={s.stateSizeTrend} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
