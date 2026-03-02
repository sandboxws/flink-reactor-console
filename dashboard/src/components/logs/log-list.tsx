"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ScrollText } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { StackTrace } from "@/components/errors/stack-trace"
import { EmptyState } from "@/components/shared/empty-state"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import type { LogEntry } from "@/data/types"
import { cn } from "@/lib/cn"
import { useAutoScroll, useSearchMatches } from "@/lib/hooks"
import { useUiStore } from "@/stores/ui-store"
import { LogLine } from "./log-line"

const ROW_HEIGHT = 24

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
  } = useAutoScroll<HTMLDivElement>()

  const { currentMatchId } = useSearchMatches()

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })

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

      {/* Jump to bottom button */}
      {!isAutoScrolling && (
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
  )
}
