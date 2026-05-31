/**
 * Restore-outcome timeline — the observed "reality" half of state-collision
 * detection. Lists restore events (newest first) with their outcome, the
 * categorized failure reason, and the checkpoint/savepoint that was restored.
 *
 * Populated by the server's restore-sync loop (state-collision-03 Phase 5).
 */

import { EmptyState, SevBadge } from "@flink-reactor/ui"
import { History } from "lucide-react"
import type { RestoreEvent } from "@/data/compatibility-types"
import { categoryLabel, outcomeTone } from "@/data/compatibility-types"

interface RestoreTimelineProps {
  restores: RestoreEvent[]
  loading: boolean
  error: string | null
}

export function RestoreTimeline({
  restores,
  loading,
  error,
}: RestoreTimelineProps) {
  if (loading && restores.length === 0) {
    return <div className="h-24 animate-pulse rounded bg-dash-surface/40" />
  }
  if (error) {
    return (
      <div className="rounded border border-fr-coral/30 bg-dash-surface p-4 text-[12px] text-fr-coral">
        Failed to load restore events: {error}
      </div>
    )
  }
  if (restores.length === 0) {
    return (
      <EmptyState
        icon={History}
        message="No restore outcomes observed yet for this pipeline."
      />
    )
  }

  return (
    <ul className="space-y-2">
      {restores.map((ev) => (
        <li
          key={ev.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-dash-surface p-3"
        >
          <SevBadge tone={outcomeTone(ev.outcome)}>{ev.outcome}</SevBadge>
          {ev.errorCategory ? (
            <SevBadge tone="fail">{categoryLabel(ev.errorCategory)}</SevBadge>
          ) : null}
          <span className="font-mono text-[11px] text-fg-muted">
            {ev.cluster}
          </span>
          {ev.jid ? (
            <span className="font-mono text-[10px] text-fg-faint">
              job {ev.jid.slice(0, 8)}
            </span>
          ) : null}
          {ev.restoredCheckpointId != null ? (
            <span className="font-mono text-[10px] text-fg-faint">
              cp #{ev.restoredCheckpointId}
            </span>
          ) : null}
          <span className="ml-auto font-mono text-[10px] text-fg-faint">
            {new Date(ev.observedAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  )
}
