/**
 * List of recent savepoints across all running pipelines.
 *
 * Filters checkpoint summaries to entries marked `isSavepoint`, sorts by
 * timestamp desc. When no savepoints exist, shows the canonical empty
 * "no savepoints yet" affordance rather than empty whitespace.
 */

import { Link } from "@tanstack/react-router"
import { Bookmark } from "lucide-react"
import type { JobCheckpointSummary } from "@/stores/checkpoint-analytics-store"

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}M`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${bytes}B`
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface SavepointsListProps {
  summaries: JobCheckpointSummary[]
  /** Cap the number of rows shown. Defaults to 6. */
  limit?: number
}

export function SavepointsList({ summaries, limit = 6 }: SavepointsListProps) {
  const savepoints = summaries
    .flatMap((s) =>
      s.recentCheckpoints
        .filter((cp) => cp.isSavepoint)
        .map((cp) => ({ summary: s, cp })),
    )
    .sort(
      (a, b) =>
        b.cp.triggerTimestamp.getTime() - a.cp.triggerTimestamp.getTime(),
    )
    .slice(0, limit)

  if (savepoints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <Bookmark className="size-4 text-fg-faint" />
        <span className="font-mono text-[10px] text-fg-faint">
          no savepoints yet
        </span>
      </div>
    )
  }

  return (
    <ul className="space-y-2 text-[12px]">
      {savepoints.map(({ summary, cp }) => (
        <li
          key={`${summary.jobId}-${cp.id}`}
          className="flex items-center justify-between"
        >
          <Link
            to="/hub/jobs/$id"
            params={{ id: summary.jobId }}
            className="font-mono text-fg hover:text-fr-coral truncate"
          >
            sp-{cp.id} · {summary.jobName}
          </Link>
          <span className="font-mono text-[10px] text-fg-faint shrink-0">
            {formatBytes(cp.size)} · {timeAgo(cp.triggerTimestamp)}
          </span>
        </li>
      ))}
    </ul>
  )
}
