/**
 * Hub log filter rail — top-of-page chip bar that toggles which log levels
 * are visible and exposes "Clear" (reset filters) and "Clear buffer" (drop
 * all entries from the store).
 *
 * Despite the name "rail" (legacy from the original mockup that placed
 * filters in a left sidebar), the bar renders horizontally above the log
 * stream in the current layout.
 */

import { type LogLevel, PropChip } from "@flink-reactor/ui"
import { X } from "lucide-react"

const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"]

/** Color tokens per level for the chip border + active tint. */
const LEVEL_TONE: Record<LogLevel, string> = {
  INFO: "#7daea3", // teal (sage-info)
  WARN: "#d8a657", // amber
  ERROR: "#ea6962", // rose
  DEBUG: "#7c7269", // dim
  TRACE: "#5a524c", // faint
}

interface LogFilterRailProps {
  activeLevels: Set<LogLevel>
  onToggleLevel: (level: LogLevel) => void
  /** Total counts per level across the full buffer. */
  levelCounts: Record<LogLevel, number>
  onClearFilters: () => void
  onClearBuffer: () => void
}

export function LogFilterRail({
  activeLevels,
  onToggleLevel,
  levelCounts,
  onClearFilters,
  onClearBuffer,
}: LogFilterRailProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <PropChip active>All sources</PropChip>
      {LEVELS.map((level) => {
        const tone = LEVEL_TONE[level]
        const isActive = activeLevels.has(level)
        return (
          <button
            key={level}
            type="button"
            onClick={() => onToggleLevel(level)}
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
        onClick={onClearFilters}
      >
        <X />
        Clear
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onClearBuffer}
        aria-label="Clear log buffer"
      >
        Clear buffer
      </button>
    </div>
  )
}

export { LEVEL_TONE }
