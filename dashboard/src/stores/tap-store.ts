import { create } from "zustand"
import type { TapMetadata } from "@flink-reactor/ui"
import { getAvailableOperators, loadTapManifest } from "@/lib/tap-manifest"
import type { ColumnInfo } from "./sql-gateway-store"

// ---------------------------------------------------------------------------
// Tap Store — manages tap UI state (selected operators, open tabs, buffered rows)
// ---------------------------------------------------------------------------

export interface TapTab {
  /** Tap node ID (unique per operator) */
  nodeId: string
  /** Human-readable name from tap metadata */
  name: string
  /** Tap metadata from the manifest */
  metadata: TapMetadata
  /** Current observation configuration */
  config: {
    offsetMode: "latest" | "earliest" | "timestamp"
    startTimestamp?: string
    endTimestamp?: string
    bufferSize: number
  }
  /** Buffered row data (ring buffer) */
  rows: Record<string, unknown>[]
  /** Column metadata from first result page */
  columns: ColumnInfo[]
  /** Row count since observation started */
  totalRowCount: number
  /** Rows received in the last second (throughput) */
  rowsPerSecond: number
}

interface TapState {
  /** Pipeline name the current manifest was loaded for */
  currentPipelineName: string | null
  /** Available operators from tap manifest */
  availableOperators: TapMetadata[]
  /** Whether the manifest is loading */
  manifestLoading: boolean
  /** Manifest load error */
  manifestError: string | null
  /** Open tap tabs keyed by nodeId */
  tabs: Record<string, TapTab>
  /** Currently active tab nodeId */
  activeTabId: string | null

  /** Load tap manifest by pipeline name (matches Flink job name) */
  loadManifest: (pipelineName: string) => Promise<void>
  /** Open a new tap tab for an operator */
  openTab: (nodeId: string) => void
  /** Close a tap tab */
  closeTab: (nodeId: string) => void
  /** Set the active tab */
  setActiveTab: (nodeId: string) => void
  /** Update observation config for a tab */
  updateConfig: (nodeId: string, config: Partial<TapTab["config"]>) => void
  /** Append rows to a tab's buffer */
  appendRows: (
    nodeId: string,
    rows: Record<string, unknown>[],
    columns?: ColumnInfo[],
  ) => void
  /** Clear all rows in a tab */
  clearRows: (nodeId: string) => void
}

// Throughput tracking: per-tab row count per second
const throughputCounters = new Map<string, number>()
let throughputInterval: ReturnType<typeof setInterval> | null = null

/** Clean up the throughput interval timer (call on HMR or unmount) */
export function cleanupThroughputTracking(): void {
  if (throughputInterval) {
    clearInterval(throughputInterval)
    throughputInterval = null
  }
  throughputCounters.clear()
}

function ensureThroughputTracking(
  getState: () => TapState,
  setState: (
    partial: Partial<TapState> | ((state: TapState) => Partial<TapState>),
  ) => void,
): void {
  if (throughputInterval) return
  throughputInterval = setInterval(() => {
    const state = getState()
    const tabs = state.tabs
    let anyActive = false

    const updatedTabs = { ...tabs }
    for (const [nodeId, tab] of Object.entries(tabs)) {
      const count = throughputCounters.get(nodeId) ?? 0
      if (count > 0 || tab.rowsPerSecond > 0) {
        updatedTabs[nodeId] = { ...tab, rowsPerSecond: count }
        anyActive = true
      }
      throughputCounters.set(nodeId, 0)
    }

    if (anyActive) {
      setState({ tabs: updatedTabs })
    }

    // Stop interval if no tabs remain
    if (Object.keys(tabs).length === 0 && throughputInterval) {
      clearInterval(throughputInterval)
      throughputInterval = null
    }
  }, 1000)
}

export const useTapStore = create<TapState>((set, get) => ({
  currentPipelineName: null,
  availableOperators: [],
  manifestLoading: false,
  manifestError: null,
  tabs: {},
  activeTabId: null,

  loadManifest: async (pipelineName: string) => {
    const state = get()

    // If switching pipelines, clean up existing tabs
    if (
      state.currentPipelineName &&
      state.currentPipelineName !== pipelineName
    ) {
      set({
        tabs: {},
        activeTabId: null,
        availableOperators: [],
      })
    }

    set({
      manifestLoading: true,
      manifestError: null,
      currentPipelineName: pipelineName,
    })

    try {
      const manifest = await loadTapManifest(pipelineName)
      const operators = getAvailableOperators(manifest)
      set({
        availableOperators: operators,
        manifestLoading: false,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tap manifest"
      set({
        manifestLoading: false,
        manifestError: message,
        availableOperators: [],
      })
    }
  },

  openTab: (nodeId: string) => {
    const state = get()
    // Don't re-open an existing tab — just switch to it
    if (state.tabs[nodeId]) {
      set({ activeTabId: nodeId })
      return
    }

    // Find the operator metadata
    const metadata = state.availableOperators.find((op) => op.nodeId === nodeId)
    if (!metadata) return

    const newTab: TapTab = {
      nodeId,
      name: metadata.name,
      metadata,
      config: {
        offsetMode: "latest",
        bufferSize: 10_000,
      },
      rows: [],
      columns: [],
      totalRowCount: 0,
      rowsPerSecond: 0,
    }

    set((s) => ({
      tabs: { ...s.tabs, [nodeId]: newTab },
      activeTabId: nodeId,
    }))

    throughputCounters.set(nodeId, 0)
    ensureThroughputTracking(get, set)
  },

  closeTab: (nodeId: string) => {
    set((state) => {
      const { [nodeId]: _, ...remaining } = state.tabs
      throughputCounters.delete(nodeId)

      // If closing the active tab, switch to another or null
      let nextActiveId = state.activeTabId
      if (state.activeTabId === nodeId) {
        const remainingIds = Object.keys(remaining)
        nextActiveId = remainingIds.length > 0 ? remainingIds[0] : null
      }

      return { tabs: remaining, activeTabId: nextActiveId }
    })
  },

  setActiveTab: (nodeId: string) => {
    set({ activeTabId: nodeId })
  },

  updateConfig: (nodeId: string, config: Partial<TapTab["config"]>) => {
    set((state) => {
      const tab = state.tabs[nodeId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [nodeId]: {
            ...tab,
            config: { ...tab.config, ...config },
          },
        },
      }
    })
  },

  appendRows: (
    nodeId: string,
    newRows: Record<string, unknown>[],
    columns?: ColumnInfo[],
  ) => {
    set((state) => {
      const tab = state.tabs[nodeId]
      if (!tab) return state

      // Merge rows, evict oldest if buffer exceeded
      let merged = [...tab.rows, ...newRows]
      if (merged.length > tab.config.bufferSize) {
        merged = merged.slice(-tab.config.bufferSize)
      }

      // Track throughput
      const current = throughputCounters.get(nodeId) ?? 0
      throughputCounters.set(nodeId, current + newRows.length)

      return {
        tabs: {
          ...state.tabs,
          [nodeId]: {
            ...tab,
            rows: merged,
            columns: columns ?? tab.columns,
            totalRowCount: tab.totalRowCount + newRows.length,
          },
        },
      }
    })
  },

  clearRows: (nodeId: string) => {
    set((state) => {
      const tab = state.tabs[nodeId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [nodeId]: {
            ...tab,
            rows: [],
            totalRowCount: 0,
            rowsPerSecond: 0,
          },
        },
      }
    })

    throughputCounters.set(nodeId, 0)
  },
}))
