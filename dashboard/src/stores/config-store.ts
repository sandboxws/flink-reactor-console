import { create } from "zustand"
import type { PublicDashboardConfig } from "@/lib/config"

// ---------------------------------------------------------------------------
// Config store — runtime configuration fetched from /api/config
// ---------------------------------------------------------------------------

interface ConfigState {
  config: PublicDashboardConfig | null
  loading: boolean
  error: string | null
}

interface ConfigActions {
  fetchConfig: () => Promise<void>
}

export type ConfigStore = ConfigState & ConfigActions

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    if (get().config) return // Already loaded
    set({ loading: true, error: null })
    try {
      const res = await fetch("/api/config")
      if (!res.ok) {
        throw new Error(`Config fetch failed: ${res.status}`)
      }
      const config: PublicDashboardConfig = await res.json()
      set({ config, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load config",
        loading: false,
      })
    }
  },
}))
