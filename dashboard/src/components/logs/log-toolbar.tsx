import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  TimeRange,
  type TimeRangeValue,
} from "@flink-reactor/ui"
import { Check, ChevronDown, Pause, Play } from "lucide-react"
import { useCallback, useMemo } from "react"
import type { LogSource } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useSearchMatches } from "@/lib/hooks"
import { useFilterStore } from "@/stores/filter-store"
import { useLogStore } from "@/stores/log-store"
import { SeverityFilter } from "./severity-filter"

export function LogToolbar({ filteredCount }: { filteredCount: number }) {
  const toggleStreaming = useLogStore((s) => s.toggleStreaming)
  const isStreaming = useLogStore((s) => s.isStreaming)

  const searchQuery = useFilterStore((s) => s.searchQuery)
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery)
  const isRegex = useFilterStore((s) => s.isRegex)
  const setIsRegex = useFilterStore((s) => s.setIsRegex)
  const timeRange = useFilterStore((s) => s.timeRange)
  const setTimeRange = useFilterStore((s) => s.setTimeRange)
  const clearTimeRange = useFilterStore((s) => s.clearTimeRange)

  const { matchCount, currentIndex, next, prev } = useSearchMatches()

  const handleTimeRangeChange = useCallback(
    (value: TimeRangeValue) => {
      if (value.start && value.end) {
        setTimeRange(value.start, value.end)
      } else {
        clearTimeRange()
      }
    },
    [setTimeRange, clearTimeRange],
  )

  const timeRangeValue: TimeRangeValue = useMemo(
    () => ({
      start: timeRange.start ?? undefined,
      end: timeRange.end ?? undefined,
    }),
    [timeRange],
  )

  return (
    <div className="flex items-center gap-2 border-b border-dash-border bg-dash-panel px-3 py-1.5">
      {/* Play/Pause */}
      <button
        type="button"
        onClick={toggleStreaming}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          isStreaming
            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]",
        )}
      >
        {isStreaming ? (
          <>
            <span className="relative mr-0.5 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <Pause className="size-3" />
          </>
        ) : (
          <Play className="size-3" />
        )}
        {isStreaming ? "Pause" : "Stream"}
      </button>

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        isRegex={isRegex}
        onRegexChange={setIsRegex}
        matchCount={matchCount}
        currentIndex={currentIndex}
        onNext={next}
        onPrev={prev}
        placeholder="Search logs..."
      />

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SeverityFilter />

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SourceDropdown />

      <div className="flex-1" />

      {filteredCount > 0 && (
        <span className="tabular-nums text-[11px] text-zinc-500">
          {filteredCount.toLocaleString()} entries
        </span>
      )}

      <TimeRange value={timeRangeValue} onChange={handleTimeRangeChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Source dropdown (Shadcn Popover)
// ---------------------------------------------------------------------------

function SourceDropdown() {
  const entries = useLogStore((s) => s.entries)
  const selectedSources = useFilterStore((s) => s.selectedSources)
  const toggleSource = useFilterStore((s) => s.toggleSource)
  const clearSources = useFilterStore((s) => s.clearSources)

  // Derive unique sources from actual log entries (works for both mock & live)
  const availableSources = useMemo(() => {
    const seen = new Map<string, LogSource>()
    for (const entry of entries) {
      if (!seen.has(entry.source.id)) {
        seen.set(entry.source.id, entry.source)
      }
    }
    // Sort: jobmanager first, then sqlgateway, then taskmanagers alphabetically
    const typeOrder: Record<string, number> = {
      jobmanager: 0,
      sqlgateway: 1,
      taskmanager: 2,
      client: 3,
    }
    return [...seen.values()].sort((a, b) => {
      const aOrder = typeOrder[a.type] ?? 99
      const bOrder = typeOrder[b.type] ?? 99
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.label.localeCompare(b.label)
    })
  }, [entries])

  const label =
    selectedSources.size === 0
      ? "All sources"
      : `${selectedSources.size} source${selectedSources.size > 1 ? "s" : ""}`

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1 rounded border border-dash-border bg-dash-surface px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200">
        {label}
        <ChevronDown className="size-3" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-44 p-1"
      >
        <button
          type="button"
          onClick={clearSources}
          className={cn(
            "w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10",
            selectedSources.size === 0 ? "text-white" : "text-zinc-400",
          )}
        >
          All sources
        </button>
        <div className="mx-1 my-1 h-px bg-dash-border" />
        {availableSources.map((source) => (
          <button
            key={source.id}
            type="button"
            onClick={() => toggleSource(source.id)}
            className={cn(
              "w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10",
              selectedSources.has(source.id) ? "text-white" : "text-zinc-400",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded border transition-colors",
                  selectedSources.has(source.id)
                    ? "border-fr-purple bg-fr-purple"
                    : "border-zinc-600",
                )}
              >
                {selectedSources.has(source.id) && (
                  <Check className="size-2.5 text-white" />
                )}
              </span>
              {source.label}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
