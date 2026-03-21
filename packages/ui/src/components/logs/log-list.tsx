"use client"

import { Collapsible, CollapsibleContent } from "../../components/ui/collapsible"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ScrollText } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StackTrace } from "../../shared/stack-trace"
import { EmptyState } from "../../shared/empty-state"
import type { LogEntry } from "../../types"
import { cn } from "../../lib/cn"
import { LogLine, type TimestampFormat } from "./log-line"

const ROW_HEIGHT = 24

export interface LogListProps {
  entries: LogEntry[]
  selectedEntryId?: string | null
  onSelectEntry?: (id: string) => void
  timestampFormat?: TimestampFormat
  searchQuery?: string
  isRegex?: boolean
  currentMatchId?: string | null
}

export function LogList({
  entries,
  selectedEntryId = null,
  onSelectEntry,
  timestampFormat = "time",
  searchQuery = "",
  isRegex = false,
  currentMatchId = null,
}: LogListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrolling, setIsAutoScrolling] = useState(true)

  // Simple auto-scroll implementation
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setIsAutoScrolling(atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      setIsAutoScrolling(true)
    }
  }, [])

  // Pause auto-scroll when a log entry is selected so it stays visible
  useEffect(() => {
    if (selectedEntryId) {
      setIsAutoScrolling(false)
    }
  }, [selectedEntryId])

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })

  // Track entry count when user scrolls away for "N new entries" badge
  const scrollAwayCountRef = useRef(entries.length)
  useEffect(() => {
    if (isAutoScrolling) {
      scrollAwayCountRef.current = entries.length
    }
  }, [isAutoScrolling, entries.length])

  // Capture snapshot the moment auto-scroll disengages
  const prevAutoScrollRef = useRef(isAutoScrolling)
  useEffect(() => {
    if (prevAutoScrollRef.current && !isAutoScrolling) {
      scrollAwayCountRef.current = entries.length
    }
    prevAutoScrollRef.current = isAutoScrolling
  }, [isAutoScrolling, entries.length])

  const newEntryCount = useMemo(
    () =>
      isAutoScrolling
        ? 0
        : Math.max(0, entries.length - scrollAwayCountRef.current),
    [isAutoScrolling, entries.length],
  )

  // Auto-scroll when entries change
  const prevLengthRef = useRef(entries.length)
  useEffect(() => {
    if (entries.length > prevLengthRef.current && isAutoScrolling) {
      const el = containerRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }
    prevLengthRef.current = entries.length
  }, [entries.length, isAutoScrolling])

  // Scroll to search match
  useEffect(() => {
    if (!currentMatchId) return
    const idx = entries.findIndex((e) => e.id === currentMatchId)
    if (idx !== -1) {
      virtualizer.scrollToIndex(idx, { align: "center" })
    }
  }, [currentMatchId, entries, virtualizer])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        message="No log entries. Press Stream to start generating mock data."
      />
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
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
            const entry = entries[virtualRow.index]
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
                  <LogLine
                    entry={entry}
                    isSelected={entry.id === selectedEntryId}
                    isExpanded={isExpanded}
                    onClick={() => onSelectEntry?.(entry.id)}
                    timestampFormat={timestampFormat}
                    searchQuery={searchQuery}
                    isRegex={isRegex}
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

      {/* Jump to bottom / new entries button */}
      {!isAutoScrolling && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full",
            "px-3 py-1.5 text-xs shadow-lg",
            "border transition-colors",
            newEntryCount > 0
              ? "border-emerald-500/30 bg-dash-panel text-emerald-400 hover:bg-dash-elevated"
              : "border-dash-border bg-dash-panel text-zinc-400 hover:text-white",
          )}
        >
          <ArrowDown className="size-3" />
          {newEntryCount > 0
            ? `${newEntryCount.toLocaleString()} new entr${newEntryCount === 1 ? "y" : "ies"}`
            : "Jump to bottom"}
        </button>
      )}
    </div>
  )
}
