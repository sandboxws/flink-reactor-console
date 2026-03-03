import { create } from "zustand"
import type { LogLevel } from "@/data/types"
import { DEFAULT_LEVEL_FILTER } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Filter store — severity toggles, search, source selection, time range
// ---------------------------------------------------------------------------

interface FilterState {
  enabledLevels: Record<LogLevel, boolean>
  searchQuery: string
  isRegex: boolean
  selectedSources: Set<string>
  timeRange: { start: Date | null; end: Date | null }
}

interface FilterActions {
  toggleLevel: (level: LogLevel) => void
  setAllLevels: (enabled: boolean) => void
  setSearchQuery: (query: string) => void
  setIsRegex: (isRegex: boolean) => void
  toggleSource: (sourceId: string) => void
  setSelectedSources: (sourceIds: Set<string>) => void
  clearSources: () => void
  setTimeRange: (start: Date | null, end: Date | null) => void
  clearTimeRange: () => void
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
