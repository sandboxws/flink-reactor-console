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

/**
 * Simulation store — manages simulation runner state and execution history.
 *
 * Fetches presets and past runs from the Go GraphQL backend, supports starting
 * and stopping simulations, and polls the active run for status updates until
 * it reaches a terminal state (COMPLETED, FAILED, CANCELLED).
 *
 * @module simulation-store
 */

interface SimulationState {
  /** Available simulation preset configurations. */
  presets: SimulationPreset[]
  /** History of all simulation runs. */
  runs: SimulationRun[]
  /** Currently active (or most recently viewed) simulation run. */
  activeRun: SimulationRun | null
  /** Whether the initial data load is in progress. */
  isLoading: boolean
  /** Error from the most recent failed operation. */
  error: string | null
}

interface SimulationActions {
  /** Load presets and runs in parallel (guarded — runs once). */
  initialize: () => Promise<void>
  /** Re-fetch simulation presets. */
  fetchPresets: () => Promise<void>
  /** Re-fetch the simulation run history. */
  fetchRuns: () => Promise<void>
  /** Fetch detail for a specific simulation run. */
  fetchRun: (runId: string) => Promise<void>
  /** Start a new simulation and begin polling for updates. */
  runSimulation: (input: SimulationInputParams) => Promise<void>
  /** Stop a running simulation and refresh state. */
  stopSimulation: (runId: string) => Promise<void>
  /** Start polling the active run for status updates (3s interval). */
  startActivePolling: (runId: string) => void
  /** Stop the active run polling interval. */
  stopActivePolling: () => void
  /** Clear the active run and stop polling. */
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
