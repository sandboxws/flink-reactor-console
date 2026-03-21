import { create } from "zustand"
import type {
  SimulationInputParams,
  SimulationPreset,
  SimulationRun,
} from "@/lib/graphql-api-client"
import {
  fetchSimulationPresets,
  fetchSimulationRun,
  fetchSimulationRuns,
  runSimulation as runSimulationApi,
  stopSimulation as stopSimulationApi,
} from "@/lib/graphql-api-client"

interface SimulationState {
  presets: SimulationPreset[]
  runs: SimulationRun[]
  activeRun: SimulationRun | null
  isLoading: boolean
  error: string | null
}

interface SimulationActions {
  initialize: () => Promise<void>
  fetchPresets: () => Promise<void>
  fetchRuns: () => Promise<void>
  fetchRun: (runId: string) => Promise<void>
  runSimulation: (input: SimulationInputParams) => Promise<void>
  stopSimulation: (runId: string) => Promise<void>
  startActivePolling: (runId: string) => void
  stopActivePolling: () => void
  clearActiveRun: () => void
}

type SimulationStore = SimulationState & SimulationActions

let initialized = false
let pollInterval: ReturnType<typeof setInterval> | null = null

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  presets: [],
  runs: [],
  activeRun: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    if (initialized) return
    initialized = true
    set({ isLoading: true })
    try {
      const [presets, runs] = await Promise.all([
        fetchSimulationPresets(),
        fetchSimulationRuns(),
      ])
      set({ presets, runs, isLoading: false, error: null })
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to load simulations",
      })
    }
  },

  fetchPresets: async () => {
    try {
      const presets = await fetchSimulationPresets()
      set({ presets })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch presets",
      })
    }
  },

  fetchRuns: async () => {
    try {
      const runs = await fetchSimulationRuns()
      set({ runs, error: null })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch runs",
      })
    }
  },

  fetchRun: async (runId: string) => {
    try {
      const run = await fetchSimulationRun(runId)
      set({ activeRun: run, error: null })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch run",
      })
    }
  },

  runSimulation: async (input: SimulationInputParams) => {
    try {
      const run = await runSimulationApi(input)
      set({ activeRun: run, error: null })
      get().startActivePolling(run.id)
      await get().fetchRuns()
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to start simulation",
      })
    }
  },

  stopSimulation: async (runId: string) => {
    try {
      await stopSimulationApi(runId)
      get().stopActivePolling()
      await Promise.all([get().fetchRuns(), get().fetchRun(runId)])
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to stop simulation",
      })
    }
  },

  startActivePolling: (runId: string) => {
    get().stopActivePolling()
    pollInterval = setInterval(async () => {
      const run = await fetchSimulationRun(runId)
      if (run) {
        set({ activeRun: run })
        if (
          run.status === "COMPLETED" ||
          run.status === "FAILED" ||
          run.status === "CANCELLED"
        ) {
          get().stopActivePolling()
          await get().fetchRuns()
        }
      }
    }, 3000)
  },

  stopActivePolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  },

  clearActiveRun: () => {
    get().stopActivePolling()
    set({ activeRun: null })
  },
}))
