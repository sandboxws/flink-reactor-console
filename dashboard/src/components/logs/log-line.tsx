import { format } from "date-fns"
import { ChevronRight } from "lucide-react"
import { memo, useMemo } from "react"
import { SeverityBadge } from "@/components/shared/severity-badge"
import { SourceBadge } from "@/components/shared/source-badge"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import type { LogEntry } from "@/data/types"
import { cn } from "@/lib/cn"
import { TIMESTAMP_FORMATS } from "@/lib/constants"
import { useFilterStore } from "@/stores/filter-store"
import { useUiStore } from "@/stores/ui-store"

function highlightText(
  text: string,
  query: string,
  isRegex: boolean,
): React.ReactNode {
  if (!query) return text

  let regex: RegExp
  try {
    regex = isRegex
      ? new RegExp(`(${query})`, "gi")
      : new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
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

export const LogLine = memo(function LogLine({
  entry,
  isSelected,
  isExpanded,
  onClick,
}: {
  entry: LogEntry
  isSelected: boolean
  isExpanded: boolean
  onClick: () => void
}) {
  const timestampFormat = useUiStore((s) => s.timestampFormat)
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const isRegex = useFilterStore((s) => s.isRegex)

  const formattedTimestamp = useMemo(
    () => format(entry.timestamp, TIMESTAMP_FORMATS[timestampFormat]),
    [entry.timestamp, timestampFormat],
  )

  const highlighted = useMemo(
    () => highlightText(entry.message, searchQuery, isRegex),
    [entry.message, searchQuery, isRegex],
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
