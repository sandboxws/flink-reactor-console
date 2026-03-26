/** Debounced search input with magnifying glass icon and optional clear button. */
"use client"

import { ChevronDown, ChevronUp, Regex, Search, X } from "lucide-react"
import { cn } from "../lib/cn"

export interface SearchInputProps {
  /** Current search query */
  value: string
  /** Called when the search query changes */
  onChange: (value: string) => void
  /** Whether regex mode is enabled */
  isRegex?: boolean
  /** Called when regex mode is toggled */
  onRegexChange?: (isRegex: boolean) => void
  /** Current match count */
  matchCount?: number
  /** Current match index (0-based) */
  currentIndex?: number
  /** Called when navigating to next match */
  onNext?: () => void
  /** Called when navigating to previous match */
  onPrev?: () => void
  /** Placeholder text */
  placeholder?: string
  className?: string
}

/**
 * SearchInput — search box with regex toggle and match navigation.
 *
 * For log/text search with support for regex patterns and
 * navigating between matches.
 */
export function SearchInput({
  value,
  onChange,
  isRegex = false,
  onRegexChange,
  matchCount,
  currentIndex = 0,
  onNext,
  onPrev,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0 text-zinc-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.shiftKey ? onPrev?.() : onNext?.()
          }
        }}
        placeholder={placeholder}
        className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
      />

      {/* Regex toggle */}
      {onRegexChange && (
        <button
          type="button"
          onClick={() => onRegexChange(!isRegex)}
          className={cn(
            "rounded p-0.5 transition-colors",
            isRegex
              ? "bg-fr-purple/20 text-fr-purple"
              : "text-zinc-500 hover:text-zinc-300",
          )}
          title="Toggle regex mode"
        >
          <Regex className="size-3" />
        </button>
      )}

      {/* Match count and navigation */}
      {value && matchCount !== undefined && (
        <>
          <span className="text-[10px] text-zinc-500">
            {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : "0/0"}
          </span>
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={matchCount === 0}
              className="text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-30"
            >
              <ChevronUp className="size-3" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={matchCount === 0}
              className="text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-30"
            >
              <ChevronDown className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="size-3" />
          </button>
        </>
      )}
    </div>
  )
}
