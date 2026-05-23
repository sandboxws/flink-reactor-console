/**
 * Error group list — left pane of `/hub/errors`. Renders a fixed-grid
 * row per `ErrorGroup` with severity icon, exception class + sample
 * source, occurrence count, last-seen, and host count.
 *
 * Selection highlights the row in coral; the parent owns selection state.
 */

import { type ErrorGroup, StatusIcon } from "@flink-reactor/ui"
import { useMemo } from "react"
import { groupState } from "./error-group-state"

interface ErrorGroupListProps {
  groups: ErrorGroup[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "—"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ErrorGroupList({
  groups,
  selectedId,
  onSelect,
}: ErrorGroupListProps) {
  const sorted = useMemo(
    () => [...groups].sort((a, b) => b.count - a.count),
    [groups],
  )
  return (
    <div className="glass-card-static overflow-hidden">
      <div className="grid grid-cols-[36px_1fr_120px_120px_60px] items-center gap-3 border-b border-dash-border px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
        <span>Sev</span>
        <span>Exception · source</span>
        <span className="text-right">Occurrences</span>
        <span className="text-right">Last seen</span>
        <span className="text-right">Hosts</span>
      </div>
      {sorted.map((g) => {
        const state = groupState(g)
        const isSelected = selectedId === g.id
        const stale = state === "suppressed"
        const accent = stale ? "text-fg-muted" : "text-fr-rose"
        const className =
          "grid grid-cols-[36px_1fr_120px_120px_60px] items-center gap-3 border-b border-dash-border/40 last:border-b-0 px-4 py-3 hover:bg-dash-elevated/30 cursor-pointer text-left w-full transition-colors"
        return (
          <button
            type="button"
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={className}
            style={
              isSelected ? { background: "rgba(231,138,78,0.10)" } : undefined
            }
          >
            <StatusIcon state={state} />
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-fg truncate">
                <span className={accent}>{g.exceptionClass}</span>
                {g.message ? `: ${g.message}` : ""}
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted truncate">
                {g.affectedSources[0]?.label ?? "unknown source"}
                {g.affectedSources.length > 1
                  ? ` · +${g.affectedSources.length - 1} more`
                  : ""}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`font-mono text-[13px] ${stale ? "text-fg-muted" : "text-fr-rose font-semibold"}`}
              >
                {g.count}
              </div>
              <div className="font-mono text-[10px] text-fg-faint">
                {stale ? "stale" : "active"}
              </div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div className="text-fg">{timeAgo(g.lastSeen)} ago</div>
              <div className="text-fg-faint">
                first {timeAgo(g.firstSeen)} ago
              </div>
            </div>
            <div className="text-right font-mono text-[11px] text-fg-muted">
              {g.affectedSources.length}
            </div>
          </button>
        )
      })}
    </div>
  )
}
