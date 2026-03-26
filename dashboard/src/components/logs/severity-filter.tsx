/**
 * @module severity-filter
 *
 * Row of toggle buttons for filtering log entries by severity level.
 * Each button corresponds to one {@link LogLevel} and toggles its
 * visibility in the log list via {@link useFilterStore}.
 */

import type { LogLevel } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useFilterStore } from "@/stores/filter-store"

/** All severity levels in ascending order. */
const LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]

/** Tailwind class pairs for the active (enabled) and inactive (disabled) states of each level button. */
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

/**
 * Log severity level toggle filter.
 *
 * Renders a horizontal row of color-coded buttons, one per {@link LogLevel}.
 * Clicking a button toggles that severity on/off in {@link useFilterStore},
 * which in turn filters the visible log entries throughout the log explorer.
 */
export function SeverityFilter() {
  const enabledLevels = useFilterStore((s) => s.enabledLevels)
  const toggleLevel = useFilterStore((s) => s.toggleLevel)

  return (
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
  )
}
