/**
 * @module rescales-tab
 *
 * Job-detail tab rendering the AdaptiveScheduler rescale history (Flink 2.3+,
 * FLIP-495). Gated behind the cluster's `RESCALE_HISTORY` capability by the
 * parent {@link JobDetail}, so it only renders against a 2.3+ cluster.
 *
 * Rescale history is a standalone REST endpoint (not part of the aggregated
 * job-detail fetch), so this tab fetches its own data on mount.
 */
import { Scaling } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import {
  fetchRescaleHistory,
  type RescaleEvent,
} from "@/lib/graphql-api-client"

function formatTimestamp(epochMillis: string): string {
  const ms = Number(epochMillis)
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  return new Date(ms).toLocaleString()
}

function RescaleStatusBadge({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "bg-job-finished/15 text-job-finished"
      : status === "FAILED"
        ? "bg-job-failed/15 text-job-failed"
        : status === "IN_PROGRESS"
          ? "bg-job-running/15 text-job-running"
          : "bg-fr-amber/15 text-fr-amber"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {status}
    </span>
  )
}

export function RescalesTab({
  jobId,
  cluster,
}: {
  jobId: string
  cluster?: string
}) {
  const [events, setEvents] = useState<RescaleEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchRescaleHistory(jobId, cluster)
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, cluster])

  if (loading) {
    return (
      <div className="glass-card flex min-h-0 flex-1 items-center justify-center py-16 text-xs text-zinc-500">
        Loading rescale history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card flex min-h-0 flex-1 items-center justify-center py-16 text-xs text-job-failed">
        Failed to load rescale history: {error}
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="glass-card flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-16 text-xs text-zinc-500">
        <Scaling className="size-5" />
        No rescale events recorded for this job yet.
      </div>
    )
  }

  return (
    <div className="glass-card overflow-auto p-4">
      <table className="w-full text-left text-xs">
        <thead className="text-zinc-400">
          <tr>
            <th className="pb-2 pr-4 font-medium">Triggered</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Parallelism</th>
            <th className="pb-2 pr-4 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.uuid} className="border-dash-border border-t">
              <td className="py-2 pr-4 text-zinc-300">
                {formatTimestamp(e.triggeredAt)}
              </td>
              <td className="py-2 pr-4">
                <RescaleStatusBadge status={e.status} />
              </td>
              <td className="py-2 pr-4 text-zinc-300">
                {e.parallelismBefore != null && e.parallelismAfter != null
                  ? `${e.parallelismBefore} → ${e.parallelismAfter}`
                  : "—"}
              </td>
              <td className="py-2 pr-4 text-zinc-300">
                {e.durationMs != null ? `${e.durationMs} ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
