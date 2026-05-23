/**
 * Unified savepoints table across all running pipelines.
 *
 * Rows come from `useClusterSavepoints`, which fans out one query per
 * running job and merges results. Renders an empty-state affordance when no
 * savepoints exist; never seeds placeholder rows.
 */

import { Link } from "@tanstack/react-router"
import { Bookmark } from "lucide-react"
import type { SavepointRow } from "@/lib/hub/use-cluster-savepoints"

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}M`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${bytes}B`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
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
  rows: SavepointRow[]
  /** True while the first fan-out is still in flight. */
  loading?: boolean
  /** Optional cap on rendered rows; omit to render all. */
  limit?: number
}

export function SavepointsList({ rows, loading, limit }: SavepointsListProps) {
  if (loading && rows.length === 0) {
    return (
      <div className="py-4 text-center font-mono text-[10px] text-fg-faint">
        loading savepoints…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <Bookmark className="size-4 text-fg-faint" />
        <span className="font-mono text-[10px] text-fg-faint">
          no savepoints yet
        </span>
      </div>
    )
  }

  const visible = limit != null ? rows.slice(0, limit) : rows

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-wider text-fg-faint border-b border-dash-border">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Job</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Trigger</th>
            <th className="px-3 py-2 text-right">Duration</th>
            <th className="px-3 py-2 text-right">Size</th>
            <th className="px-3 py-2 text-right">Triggered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border/40">
          {visible.map((row) => {
            const statusClass =
              row.status === "COMPLETED"
                ? "text-fr-sage"
                : row.status === "FAILED"
                  ? "text-fr-rose"
                  : "text-fr-amber"
            return (
              <tr
                key={`${row.jobId}-${row.id}`}
                className="hover:bg-dash-elevated/30"
                title={row.error ?? row.location ?? undefined}
              >
                <td className="px-3 py-2 font-mono text-fg-muted truncate max-w-[12ch]">
                  {row.id}
                </td>
                <td className="px-3 py-2">
                  <Link
                    to="/hub/jobs/$id"
                    params={{ id: row.jobId }}
                    className="font-mono text-fg hover:text-fr-coral"
                  >
                    {row.jobName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`font-mono text-[10px] ${statusClass}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-fg-muted">
                  {row.triggerType}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatDuration(row.durationMs)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatBytes(row.sizeBytes)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-fg-faint">
                  {timeAgo(row.triggeredAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
