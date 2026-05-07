/**
 * Hub log explorer — /hub/logs.
 *
 * Mirrors `console-v2/logs.html`. Streams entries from `useLogStore`
 * (which polls JM/TM/SQL Gateway log endpoints with byte-offset deltas)
 * and renders them through the Hub `.log-viewer` mono-grid. Level
 * toggles + free-text search + click-to-select detail panel match the
 * mockup's two-pane layout.
 *
 * Filtering happens client-side from the buffer (cap = LOG_BUFFER_LIMIT
 * in `lib/constants`). Server-side query DSL ("level>=WARN AND msg~..")
 * shown in the mockup is deferred — the input here is plain substring
 * filter today.
 */

import {
  HubBreadcrumb,
  LiveDot,
  PropChip,
  type LogEntry,
  type LogLevel,
} from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  BookmarkPlus,
  Copy,
  Download,
  Pause,
  Play,
  Terminal,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useLogStore } from "@/stores/log-store"

const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"]

/** Color tokens per level for the log-row chips and detail accent. */
const LEVEL_TONE: Record<LogLevel, string> = {
  INFO: "#7daea3", // teal (sage-info)
  WARN: "#d8a657", // amber
  ERROR: "#ea6962", // rose
  DEBUG: "#7c7269", // dim
  TRACE: "#5a524c", // faint
}

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "—"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

function formatHHMMSSms(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, "0")}`
}

function HubLogs() {
  const initialize = useClusterStore((s) => s.initialize)
  const startStreaming = useLogStore((s) => s.startStreaming)
  const stopStreaming = useLogStore((s) => s.stopStreaming)
  const toggleStreaming = useLogStore((s) => s.toggleStreaming)
  const clearLogs = useLogStore((s) => s.clear)
  const isStreaming = useLogStore((s) => s.isStreaming)
  const entries = useLogStore((s) => s.entries)
  const taskManagers = useClusterStore((s) => s.taskManagers)

  const [query, setQuery] = useState("")
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    () => new Set(["INFO", "WARN", "ERROR"]),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    initialize()
    startStreaming()
    return () => stopStreaming()
  }, [initialize, startStreaming, stopStreaming])

  /** Counts per level across the entire buffer (for chip badges). */
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      DEBUG: 0,
      TRACE: 0,
    }
    for (const e of entries) counts[e.level]++
    return counts
  }, [entries])

  const filtered = useMemo(() => {
    const lower = query.toLowerCase()
    return entries.filter((e) => {
      if (!activeLevels.has(e.level)) return false
      if (
        lower &&
        !e.message.toLowerCase().includes(lower) &&
        !e.logger.toLowerCase().includes(lower) &&
        !e.source.label.toLowerCase().includes(lower)
      ) {
        return false
      }
      return true
    })
  }, [entries, activeLevels, query])

  const selected = useMemo(
    () => (selectedId ? filtered.find((e) => e.id === selectedId) : null),
    [selectedId, filtered],
  )

  const sourcesSummary = useMemo(() => {
    const tmCount = taskManagers.length
    return `${tmCount} task manager${tmCount === 1 ? "" : "s"} · 1 job manager · 1 SQL gateway`
  }, [taskManagers])

  function toggleLevel(level: LogLevel) {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  return (
    <HubAppShell>
      {/* ── Header ─────────────────────────────────────────────── */}
      <HubBreadcrumb crumbs={[{ label: "Logs" }]} LinkComponent={HubLink} />
      <div className="mt-1 mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Log explorer
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Streaming from {sourcesSummary}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled
            aria-label="Export logs (not implemented)"
          >
            <Download />
            Export
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled
            aria-label="Save query (not implemented)"
          >
            <BookmarkPlus />
            Save query
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={toggleStreaming}
            aria-label={isStreaming ? "Pause stream" : "Resume stream"}
          >
            {isStreaming ? <LiveDot /> : <Play />}
            {isStreaming ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* ── Filter chip bar ────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PropChip active>All sources</PropChip>
        {LEVELS.map((level) => {
          const tone = LEVEL_TONE[level]
          const isActive = activeLevels.has(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`prop-chip ${isActive ? "active" : ""}`}
              style={
                isActive
                  ? {
                      color: tone,
                      borderColor: `${tone}66`,
                      background: `${tone}11`,
                    }
                  : undefined
              }
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: tone }}
              />
              {level}
              <span className="count">{levelCounts[level].toLocaleString()}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto"
          onClick={() => {
            setQuery("")
            setActiveLevels(new Set(["INFO", "WARN", "ERROR"]))
          }}
        >
          <X />
          Clear
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={clearLogs}
          aria-label="Clear log buffer"
        >
          Clear buffer
        </button>
      </div>

      {/* ── Search bar ─────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-dash-border bg-fr-subtle/50 px-3 py-2">
        <Terminal className="text-fg-muted size-4" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-faint"
          placeholder="Substring filter — matches message, logger, or source label"
        />
        <span className="text-[10px] font-mono text-fg-faint">
          {filtered.length.toLocaleString()} match
          {filtered.length === 1 ? "" : "es"}
        </span>
      </div>

      {/* ── 2-pane layout ──────────────────────────────────────── */}
      <section className="grid grid-cols-12 gap-4">
        {/* Log stream */}
        <div
          className={
            selected ? "col-span-12 xl:col-span-8" : "col-span-12"
          }
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-fg-muted">
                {filtered.length.toLocaleString()} events
              </span>
              {isStreaming ? (
                <>
                  <span className="text-fg-faint text-[10px]">·</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-fr-sage">
                    <LiveDot /> live
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={toggleStreaming}
                aria-label={isStreaming ? "Pause" : "Play"}
              >
                {isStreaming ? <Pause /> : <Play />}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                disabled
                aria-label="Download (not implemented)"
              >
                <Download />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                disabled
                aria-label="Copy (not implemented)"
              >
                <Copy />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card-static p-10 text-center text-[12px] text-fg-muted">
              {entries.length === 0
                ? "Waiting for first log lines…"
                : "No log entries match the current filters."}
            </div>
          ) : (
            <div
              className="log-viewer"
              style={{ maxHeight: "64vh", overflow: "auto" }}
            >
              {filtered.slice(-500).map((entry, i) => (
                <LogRow
                  key={entry.id}
                  index={i + 1}
                  entry={entry}
                  selected={selected?.id === entry.id}
                  onSelect={() => setSelectedId(entry.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-fg-faint font-mono">
            <span>
              buffer {entries.length.toLocaleString()} ·{" "}
              {entries[0]
                ? `oldest ${formatHHMMSSms(entries[0].timestamp)}`
                : "no data"}
            </span>
            <span>
              {entries[entries.length - 1]
                ? `newest ${formatHHMMSSms(entries[entries.length - 1].timestamp)} (${timeAgo(entries[entries.length - 1].timestamp)} ago)`
                : ""}
            </span>
          </div>
        </div>

        {/* Right detail panel */}
        {selected ? (
          <aside className="col-span-12 xl:col-span-4">
            <LogDetailCard
              entry={selected}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        ) : null}
      </section>
    </HubAppShell>
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

function LogDetailCard({
  entry,
  onClose,
}: {
  entry: LogEntry
  onClose: () => void
}) {
  return (
    <div className="glass-card-static p-4 sticky top-20">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={
              entry.level === "ERROR" || entry.level === "WARN"
                ? "status-icon firing"
                : "status-icon resolved"
            }
          />
          <span className="font-mono text-[12px] text-fg">
            Event #{entry.id.slice(0, 8)}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X />
        </button>
      </div>
      <div className="font-mono text-[11px] text-fg-muted mb-2">
        {formatHHMMSSms(entry.timestamp)} ·{" "}
        <span style={{ color: LEVEL_TONE[entry.level] }}>{entry.level}</span>
      </div>
      <div className="font-mono text-[12px] text-fg leading-relaxed break-words">
        {entry.message}
      </div>

      <div className="my-3 border-t border-dash-border" />

      <dl className="space-y-2 text-[11px]">
        <DetailRow label="source" value={entry.source.label} />
        {entry.source.type === "taskmanager" ? (
          <DetailRow
            label="tm"
            value={
              <Link
                to="/hub/task-managers/$id"
                params={{ id: entry.source.id }}
                className="text-fr-coral hover:underline"
              >
                {entry.source.id}
              </Link>
            }
          />
        ) : null}
        <DetailRow
          label="thread"
          value={<span className="break-all">{entry.thread || "—"}</span>}
        />
        <DetailRow
          label="logger"
          value={
            <span className="text-fg-muted break-all">
              {entry.logger || "—"}
            </span>
          }
        />
      </dl>

      {entry.stackTrace ? (
        <>
          <div className="my-3 border-t border-dash-border" />
          <div className="text-[10px] font-mono uppercase tracking-wider text-fg-faint mb-2">
            Stack trace
          </div>
          <pre className="rounded bg-fr-bg/60 p-2.5 font-mono text-[11px] leading-relaxed text-fg-muted overflow-x-auto whitespace-pre">
            {entry.stackTrace}
          </pre>
        </>
      ) : null}
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="font-mono text-fg-faint">{label}</dt>
      <dd className="col-span-2 font-mono text-fg">{value}</dd>
    </div>
  )
}

export const Route = createFileRoute("/hub/logs")({
  component: HubLogs,
})
