/**
 * @module log-list
 *
 * Virtualized log entry list with auto-scroll, search-match navigation,
 * and inline stack trace expansion. Uses TanStack Virtual to efficiently
 * render large log buffers (up to 100k entries) without DOM overhead.
 * Auto-scroll keeps the view pinned to the bottom during live streaming
 * but pauses when the user selects an entry or scrolls away, showing a
 * "jump to bottom" badge with a count of new entries received while away.
 */

import {
  Collapsible,
  CollapsibleContent,
  EmptyState,
} from "@flink-reactor/ui"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ScrollText } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StackTrace } from "@/components/errors/stack-trace"
import type { LogEntry } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useAutoScroll, useSearchMatches } from "@/lib/hooks"
import { useUiStore } from "@/stores/ui-store"
import { LogLine } from "./log-line"

/** Estimated height in pixels for each log row (used by the virtualizer). */
const ROW_HEIGHT = 24

/**
 * Virtualized log entry list with auto-scroll and inline stack trace expansion.
 *
 * Renders {@link LogLine} for each entry inside a TanStack Virtual scroller.
 * Entries with stack traces are wrapped in a {@link Collapsible} so the user
 * can expand them in-place. Subscribes to {@link useUiStore} for entry
 * selection and {@link useSearchMatches} for search result navigation.
 */
export function LogList({ entries }: { entries: LogEntry[] }) {
  const selectedEntryId = useUiStore((s) => s.selectedEntryId)
  const setSelectedEntryId = useUiStore((s) => s.setSelectedEntryId)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const {
    containerRef,
    isAutoScrolling,
    handleScroll,
    scrollToBottom,
    scrollIfNeeded,
    pauseAutoScroll,
  } = useAutoScroll<HTMLDivElement>()

  // Pause auto-scroll when a log entry is selected so it stays visible
  useEffect(() => {
    if (selectedEntryId) {
      pauseAutoScroll()
    }
  }, [selectedEntryId, pauseAutoScroll])

  const { currentMatchId } = useSearchMatches()

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
      // Reset: user is back at the bottom
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
    if (entries.length > prevLengthRef.current) {
      scrollIfNeeded()
    }
    prevLengthRef.current = entries.length
  }, [entries.length, scrollIfNeeded])

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
              ? "border-status-active/30 bg-dash-panel text-status-active hover:bg-dash-elevated"
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
