/**
 * Hub log stream — `.log-viewer` mono-grid that renders up to N log rows
 * with click-to-select. Trims to the most-recent slice (default 500) to
 * keep DOM weight bounded; the parent passes the already-filtered entries.
 *
 * Each row is a `<LogRow>` (defined here, not exported) that carries
 * keyboard handlers (Enter/Space) for accessibility.
 */

import type { LogEntry } from "@flink-reactor/ui"

interface HubLogViewerProps {
  entries: LogEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Most recent N entries to render (default 500). */
  tail?: number
  /** CSS max-height for the scroll container. Default `64vh`. */
  maxHeight?: string
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

export function formatHHMMSSms(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, "0")}`
}

export function HubLogViewer({
  entries,
  selectedId,
  onSelect,
  tail = 500,
  maxHeight = "64vh",
}: HubLogViewerProps) {
  return (
    <div className="log-viewer" style={{ maxHeight, overflow: "auto" }}>
      {entries.slice(-tail).map((entry, i) => (
        <LogRow
          key={entry.id}
          index={i + 1}
          entry={entry}
          selected={selectedId === entry.id}
          onSelect={() => onSelect(entry.id)}
        />
      ))}
    </div>
  )
}

function LogRow({
  index,
  entry,
  selected,
  onSelect,
}: {
  index: number
  entry: LogEntry
  selected: boolean
  onSelect: () => void
}) {
  const level = entry.level.toLowerCase()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className="log-row cursor-pointer"
      style={
        selected
          ? { background: "rgba(231,138,78,0.08)" }
          : entry.level === "ERROR"
            ? { background: "rgba(234,105,98,0.04)" }
            : undefined
      }
    >
      <span className="log-num">{index}</span>
      <span className="log-time">{formatHHMMSSms(entry.timestamp)}</span>
      <span className={`log-level ${level}`}>{entry.level}</span>
      <span className={`log-msg ${level}`}>
        <span className="text-fg-faint">[{entry.source.label}]</span>{" "}
        {entry.loggerShort ? (
          <>
            <span className="text-fg-faint">{entry.loggerShort}</span> —{" "}
          </>
        ) : null}
        {entry.message}
      </span>
    </div>
  )
}
