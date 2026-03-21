"use client"

import { useState, useMemo } from "react"
import { LogList } from "../../components/logs/log-list"
import { LogHistogram } from "../../components/logs/log-histogram"
import type { LogEntry, LogLevel } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LogExplorerSectionProps {
  logs: LogEntry[]
  onFilterChange?: (filter: Record<LogLevel, boolean>) => void
  timestampFormat?: "full" | "time" | "short"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ALL_LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]

const DEFAULT_FILTER: Record<LogLevel, boolean> = {
  TRACE: true,
  DEBUG: true,
  INFO: true,
  WARN: true,
  ERROR: true,
}

export function LogExplorerSection({
  logs,
  onFilterChange,
  timestampFormat = "time",
}: LogExplorerSectionProps) {
  const [filter, setFilter] = useState<Record<LogLevel, boolean>>(DEFAULT_FILTER)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredLogs = useMemo(
    () => logs.filter((l) => filter[l.level]),
    [logs, filter],
  )

  function toggleLevel(level: LogLevel) {
    const next = { ...filter, [level]: !filter[level] }
    setFilter(next)
    onFilterChange?.(next)
  }

  return (
    <section className="flex h-full flex-col overflow-hidden">
      {/* Level filter pills */}
      <div className="flex items-center gap-1.5 border-b border-dash-border px-3 py-2">
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => toggleLevel(level)}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              filter[level]
                ? "border-zinc-600 bg-white/[0.06] text-zinc-200"
                : "border-transparent bg-transparent text-zinc-600"
            }`}
          >
            {level}
          </button>
        ))}
        <span className="ml-auto text-[10px] tabular-nums text-zinc-600">
          {filteredLogs.length} / {logs.length}
        </span>
      </div>

      {/* Histogram */}
      <LogHistogram entries={filteredLogs} />

      {/* Log list */}
      <div className="flex-1 overflow-hidden">
        <LogList
          entries={filteredLogs}
          selectedEntryId={selectedId}
          onSelectEntry={setSelectedId}
          timestampFormat={timestampFormat}
        />
      </div>
    </section>
  )
}
