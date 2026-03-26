import { create } from "zustand"
import type { LogLevel } from "@flink-reactor/ui"
import { DEFAULT_LEVEL_FILTER } from "@/lib/constants"

/**
 * Filter store — log severity toggles, text search, source selection, and time range.
 *
 * Used by the log explorer to filter the buffered log entries from log-store.
 * All filter state is client-side only (no persistence). Supports plain text
 * and regex search modes.
 *
 * @module filter-store
 */

interface FilterState {
  /** Per-severity toggle map (true = show entries of that level). */
  enabledLevels: Record<LogLevel, boolean>
  /** Free-text or regex search query applied to log messages. */
  searchQuery: string
  /** Whether searchQuery is interpreted as a regular expression. */
  isRegex: boolean
  /** Set of selected source IDs (empty = show all sources). */
  selectedSources: Set<string>
  /** Optional time range filter with start/end bounds. */
  timeRange: { start: Date | null; end: Date | null }
}

interface FilterActions {
  /** Toggle a single log severity level on/off. */
  toggleLevel: (level: LogLevel) => void
  /** Enable or disable all severity levels at once. */
  setAllLevels: (enabled: boolean) => void
  /** Update the search query string. */
  setSearchQuery: (query: string) => void
  /** Toggle regex mode for the search query. */
  setIsRegex: (isRegex: boolean) => void
  /** Toggle a single source ID in the selection set. */
  toggleSource: (sourceId: string) => void
  /** Replace the entire source selection set. */
  setSelectedSources: (sourceIds: Set<string>) => void
  /** Clear all source selections (show all sources). */
  clearSources: () => void
  /** Set the time range filter bounds. */
  setTimeRange: (start: Date | null, end: Date | null) => void
  /** Clear the time range filter. */
  clearTimeRange: () => void
  /** Reset all filters to their initial defaults. */
  resetAll: () => void
}

export type FilterStore = FilterState & FilterActions

const INITIAL_STATE: FilterState = {
  enabledLevels: { ...DEFAULT_LEVEL_FILTER },
  searchQuery: "",
  isRegex: false,
  selectedSources: new Set<string>(),
  timeRange: { start: null, end: null },
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...INITIAL_STATE,

  toggleLevel: (level: LogLevel) => {
    set((state) => ({
      enabledLevels: {
        ...state.enabledLevels,
        [level]: !state.enabledLevels[level],
      },
    }))
  },

  setAllLevels: (enabled: boolean) => {
    set({
      enabledLevels: {
        TRACE: enabled,
        DEBUG: enabled,
        INFO: enabled,
        WARN: enabled,
        ERROR: enabled,
      },
    })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setIsRegex: (isRegex: boolean) => {
    set({ isRegex })
  },

  toggleSource: (sourceId: string) => {
    set((state) => {
      const next = new Set(state.selectedSources)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return { selectedSources: next }
    })
  },

  setSelectedSources: (sourceIds: Set<string>) => {
    set({ selectedSources: new Set(sourceIds) })
  },

  clearSources: () => {
    set({ selectedSources: new Set<string>() })
  },

  setTimeRange: (start: Date | null, end: Date | null) => {
    set({ timeRange: { start, end } })
  },

  clearTimeRange: () => {
    set({ timeRange: { start: null, end: null } })
  },

  resetAll: () => {
    set({ ...INITIAL_STATE, selectedSources: new Set<string>() })
  },
}))
