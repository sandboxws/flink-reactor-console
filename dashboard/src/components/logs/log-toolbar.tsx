"use client"

import { Check, ChevronDown, Pause, Play } from "lucide-react"
import { useMemo } from "react"
import { SearchInput } from "@/components/shared/search-input"
import { TimeRange } from "@/components/shared/time-range"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { LogSource } from "@/data/types"
import { cn } from "@/lib/cn"
import { useFilterStore } from "@/stores/filter-store"
import { useLogStore } from "@/stores/log-store"
import { SeverityFilter } from "./severity-filter"

export function LogToolbar() {
  const toggleStreaming = useLogStore((s) => s.toggleStreaming)
  const isStreaming = useLogStore((s) => s.isStreaming)

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
          <Pause className="size-3" />
        ) : (
          <Play className="size-3" />
        )}
        {isStreaming ? "Pause" : "Stream"}
      </button>

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SearchInput />

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SeverityFilter />

      <div className="mx-1 h-4 w-px bg-dash-border" />

      <SourceDropdown />

      <div className="flex-1" />

      <TimeRange />
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
    // Sort: jobmanager first, then taskmanagers alphabetically by label
    return [...seen.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "jobmanager" ? -1 : 1
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
