"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { format } from "date-fns"
import {
  ArrowDown,
  ChevronRight,
  Copy,
  ScrollText,
  Search,
  X,
} from "lucide-react"
import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { StackTrace } from "@/components/errors/stack-trace"
import { EmptyState } from "@/components/shared/empty-state"
import { SeverityBadge } from "@/components/shared/severity-badge"
import { SourceBadge } from "@/components/shared/source-badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LogEntry, LogLevel } from "@/data/types"
import { cn } from "@/lib/cn"
import { DEFAULT_LEVEL_FILTER, SEVERITY_COLORS } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]
const ROW_HEIGHT = 24
const BUCKET_COUNT = 60
const TIMESTAMP_FMT = "yyyy-MM-dd HH:mm:ss.SSS"

const LEVEL_STYLES: Record<LogLevel, { active: string; inactive: string }> = {
  TRACE: {
    active: "bg-log-trace/20 text-log-trace border-log-trace/40",
    inactive: "text-zinc-600 border-zinc-700/50 hover:text-log-trace/60",
  },
  DEBUG: {
    active: "bg-log-debug/20 text-log-debug border-log-debug/40",
    inactive: "text-zinc-600 border-zinc-700/50 hover:text-log-debug/60",
  },
  INFO: {
    active: "bg-log-info/20 text-log-info border-log-info/40",
    inactive: "text-zinc-600 border-zinc-700/50 hover:text-log-info/60",
  },
  WARN: {
    active: "bg-log-warn/20 text-log-warn border-log-warn/40",
    inactive: "text-zinc-600 border-zinc-700/50 hover:text-log-warn/60",
  },
  ERROR: {
    active: "bg-log-error/20 text-log-error border-log-error/40",
    inactive: "text-zinc-600 border-zinc-700/50 hover:text-log-error/60",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text

  let regex: RegExp
  try {
    regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    )
  } catch {
    return text
  }

  const parts = text.split(regex)
  if (parts.length === 1) return text

  const result: React.ReactNode[] = []
  let matchCounter = 0
  for (const part of parts) {
    if (regex.test(part)) {
      result.push(
        <mark
          key={`hl-${matchCounter++}`}
          className="rounded-sm bg-amber-400/30 px-px text-amber-200"
        >
          {part}
        </mark>,
      )
    } else {
      result.push(part)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

interface Bucket {
  time: number
  label: string
  TRACE: number
  DEBUG: number
  INFO: number
  WARN: number
  ERROR: number
}

function HistogramTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value > 0)
  if (items.length === 0) return null

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="mb-0.5 text-[10px] text-fg-muted">{label}</p>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="text-fg-secondary">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function bucketize(entries: LogEntry[]): Bucket[] {
  if (entries.length === 0) return []

  const first = entries[0].timestamp.getTime()
  const last = entries[entries.length - 1].timestamp.getTime()
  const range = Math.max(last - first, 60_000)
  const bucketSize = range / BUCKET_COUNT

  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const t = first + i * bucketSize
    const d = new Date(t)
    return {
      time: t,
      label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      TRACE: 0,
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    }
  })

  for (const entry of entries) {
    const idx = Math.min(
      Math.floor((entry.timestamp.getTime() - first) / bucketSize),
      BUCKET_COUNT - 1,
    )
    if (idx >= 0) {
      buckets[idx][entry.level]++
    }
  }

  return buckets
}

function StaticHistogram({ entries }: { entries: LogEntry[] }) {
  const data = useMemo(() => bucketize(entries), [entries])
  if (data.length === 0) return null

  return (
    <div className="relative z-20 h-10 w-full border-b border-dash-border bg-dash-surface">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={1}
        >
          <XAxis dataKey="label" hide />
          <Tooltip
            content={<HistogramTooltip />}
            cursor={{ fill: "var(--color-chart-cursor-fill)" }}
            isAnimationActive={false}
            wrapperStyle={{
              opacity: 1,
              background: "none",
              border: "none",
              padding: 0,
            }}
          />
          {LEVELS.map((level) => (
            <Bar
              key={level}
              dataKey={level}
              stackId="severity"
              fill={SEVERITY_COLORS[level]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StaticLogLine — same visual pattern as LogLine but self-contained
// ---------------------------------------------------------------------------

const StaticLogLine = memo(function StaticLogLine({
  entry,
  isSelected,
  isExpanded,
  searchQuery,
  onClick,
}: {
  entry: LogEntry
  isSelected: boolean
  isExpanded: boolean
  searchQuery: string
  onClick: () => void
}) {
  const formattedTimestamp = useMemo(
    () => format(entry.timestamp, TIMESTAMP_FMT),
    [entry.timestamp],
  )

  const highlighted = useMemo(
    () => highlightText(entry.message, searchQuery),
    [entry.message, searchQuery],
  )

  return (
    <button
      type="button"
      className={cn(
        "log-line flex w-full cursor-pointer items-center gap-2 text-left",
        isSelected && "log-line-selected",
        !isSelected && entry.level === "ERROR" && "log-line-error",
        !isSelected && entry.level === "WARN" && "log-line-warn",
      )}
      onClick={onClick}
    >
      {/* Expand toggle for stack traces */}
      <span className="inline-flex w-3 shrink-0 items-center justify-center">
        {entry.isException ? (
          <CollapsibleTrigger asChild>
            <span
              className="text-zinc-500 transition-colors hover:text-zinc-300"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <ChevronRight
                className={cn(
                  "size-3 transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
            </span>
          </CollapsibleTrigger>
        ) : null}
      </span>

      {/* Timestamp */}
      <span className="shrink-0 text-zinc-500">{formattedTimestamp}</span>

      {/* Severity */}
      <SeverityBadge level={entry.level} />

      {/* Source */}
      <SourceBadge source={entry.source} />

      {/* Logger (abbreviated) */}
      <span className="shrink-0 text-zinc-400">{entry.loggerShort}</span>

      {/* Message */}
      <span className="min-w-0 flex-1 truncate text-zinc-200">
        {highlighted}
      </span>
    </button>
  )
})

// ---------------------------------------------------------------------------
// Detail panel — simplified inline panel
// ---------------------------------------------------------------------------

function DetailField({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-500">{label}</span>
      <span className={cn("min-w-0 text-zinc-200", mono && "font-mono")}>
        {children}
      </span>
    </div>
  )
}

function StaticDetailPanel({
  entry,
  entries,
  onClose,
}: {
  entry: LogEntry
  entries: LogEntry[]
  onClose: () => void
}) {
  const contextLines = useMemo(() => {
    const idx = entries.indexOf(entry)
    if (idx === -1) return []
    const start = Math.max(0, idx - 5)
    const end = Math.min(entries.length, idx + 6)
    return entries.slice(start, end)
  }, [entries, entry])

  function copyRaw() {
    navigator.clipboard.writeText(entry.raw)
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-dash-border bg-dash-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
        <span className="text-xs font-medium text-zinc-300">Log Detail</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyRaw}
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
            title="Copy raw log text"
          >
            <Copy className="size-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs
        defaultValue="details"
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="details" className="detail-tab">
            Details
          </TabsTrigger>
          {entry.stackTrace && (
            <TabsTrigger value="stacktrace" className="detail-tab">
              Trace
            </TabsTrigger>
          )}
          <TabsTrigger value="context" className="detail-tab">
            Context
          </TabsTrigger>
          <TabsTrigger value="raw" className="detail-tab">
            Raw
          </TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent
          value="details"
          className="flex flex-1 flex-col gap-4 overflow-auto p-4"
        >
          <div className="flex items-center gap-2">
            <SeverityBadge level={entry.level} />
            <SourceBadge source={entry.source} />
          </div>

          <div className="rounded bg-black/30 p-3">
            <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-200">
              {entry.message}
            </p>
          </div>

          <div className="space-y-2">
            <DetailField label="Timestamp" mono>
              {format(entry.timestamp, "yyyy-MM-dd HH:mm:ss.SSS")}
            </DetailField>
            <DetailField label="Logger" mono>
              <span className="break-all">{entry.logger}</span>
            </DetailField>
            <DetailField label="Short Name">{entry.loggerShort}</DetailField>
            <DetailField label="Thread" mono>
              {entry.thread}
            </DetailField>
            <DetailField label="Source">
              <SourceBadge source={entry.source} />
            </DetailField>
            <DetailField label="Level">
              <SeverityBadge level={entry.level} />
            </DetailField>
            {entry.isException && (
              <DetailField label="Exception">
                <span className="text-log-error">Yes</span>
              </DetailField>
            )}
          </div>
        </TabsContent>

        {/* Stack Trace tab */}
        {entry.stackTrace && (
          <TabsContent value="stacktrace" className="flex-1 overflow-auto p-4">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">
              Stack Trace
            </h3>
            <StackTrace raw={entry.stackTrace} />
          </TabsContent>
        )}

        {/* Context tab */}
        <TabsContent value="context" className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-xs font-medium text-zinc-400">
            Surrounding Lines
          </h3>
          <div className="rounded bg-black/30 p-3">
            {contextLines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "font-mono text-[11px] leading-relaxed",
                  line.id === entry.id ? "text-white" : "text-zinc-500",
                )}
              >
                <span className="text-zinc-600">
                  {format(line.timestamp, "HH:mm:ss.SSS")}
                </span>{" "}
                <span
                  className={cn(
                    line.level === "ERROR" && "text-log-error",
                    line.level === "WARN" && "text-log-warn",
                  )}
                >
                  {line.level.padEnd(5)}
                </span>{" "}
                {line.message.substring(0, 80)}
                {line.message.length > 80 ? "..." : ""}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Raw tab */}
        <TabsContent value="raw" className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-xs font-medium text-zinc-400">Raw Output</h3>
          <pre className="whitespace-pre-wrap rounded bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {entry.raw}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StaticLogExplorer — self-contained log viewer matching /logs visual style
// ---------------------------------------------------------------------------

export function StaticLogExplorer({
  entries,
  className,
}: {
  entries: LogEntry[]
  className?: string
}) {
  const [enabledLevels, setEnabledLevels] = useState<Record<LogLevel, boolean>>(
    () => ({ ...DEFAULT_LEVEL_FILTER }),
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Filter entries
  const filtered = useMemo(() => {
    let result = entries
    result = result.filter((e) => enabledLevels[e.level])
    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(lower) ||
          e.logger.toLowerCase().includes(lower),
      )
    }
    return result
  }, [entries, enabledLevels, searchQuery])

  const selectedEntry = useMemo(
    () =>
      selectedEntryId
        ? (entries.find((e) => e.id === selectedEntryId) ?? null)
        : null,
    [entries, selectedEntryId],
  )

  const toggleLevel = useCallback((level: LogLevel) => {
    setEnabledLevels((prev) => ({ ...prev, [level]: !prev[level] }))
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border border-dash-border bg-dash-surface",
        className ?? "h-[600px]",
      )}
    >
      {/* Main panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-dash-border bg-dash-panel px-3 py-1.5">
          {/* Search */}
          <div className="flex items-center gap-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1">
            <Search className="size-3.5 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="mx-1 h-4 w-px bg-dash-border" />

          {/* Severity filter */}
          <div className="flex items-center gap-1">
            {LEVELS.map((level) => {
              const enabled = enabledLevels[level]
              const style = LEVEL_STYLES[level]
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors",
                    enabled ? style.active : style.inactive,
                  )}
                >
                  {level}
                </button>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Entry count */}
          <span className="font-mono text-[10px] tabular-nums text-zinc-600">
            {filtered.length} / {entries.length}
          </span>
        </div>

        {/* Histogram */}
        <StaticHistogram entries={filtered} />

        {/* Virtualized list */}
        <div className="relative flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              message="No log entries match the current filters."
            />
          ) : (
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="h-full overflow-auto scrollbar-hide"
            >
              <div
                className="relative w-full"
                style={{ height: virtualizer.getTotalSize() }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const entry = filtered[virtualRow.index]
                  const isExpanded = expandedIds.has(entry.id)
                  return (
                    <div
                      key={entry.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={() => toggleExpand(entry.id)}
                      >
                        <StaticLogLine
                          entry={entry}
                          isSelected={entry.id === selectedEntryId}
                          isExpanded={isExpanded}
                          searchQuery={searchQuery}
                          onClick={() => setSelectedEntryId(entry.id)}
                        />
                        {entry.stackTrace && (
                          <CollapsibleContent className="collapsible-panel max-h-48 overflow-y-auto px-7 py-2">
                            <StackTrace raw={entry.stackTrace} />
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Jump to bottom */}
          {!isAtBottom && filtered.length > 0 && (
            <button
              type="button"
              onClick={scrollToBottom}
              className={cn(
                "absolute bottom-3 right-3 flex items-center gap-1 rounded-full",
                "bg-dash-panel/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg",
                "border border-dash-border transition-colors hover:text-white",
              )}
            >
              <ArrowDown className="size-3" />
              Jump to bottom
            </button>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedEntry && (
        <StaticDetailPanel
          entry={selectedEntry}
          entries={entries}
          onClose={() => setSelectedEntryId(null)}
        />
      )}
    </div>
  )
}
