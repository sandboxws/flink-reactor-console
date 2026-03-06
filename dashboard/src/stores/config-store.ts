import { create } from "zustand"
import { fetchDashboardConfig } from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Config store — runtime configuration fetched from GraphQL dashboardConfig
// ---------------------------------------------------------------------------

/**
 * Browser-safe config subset sourced from the Go server's GraphQL
 * dashboardConfig query (which returns clusters + instruments) with sensible
 * defaults for the remaining fields.
 */
export interface PublicDashboardConfig {
  pollIntervalMs: number
  logBufferSize: number
  clusterDisplayName: string
  logLevel: string | null
  clusters: string[]
  rbacEnabled: boolean
  prometheusEnabled: boolean
  alertWebhookEnabled: boolean
}

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
      const data = await fetchDashboardConfig()
      const config: PublicDashboardConfig = {
        pollIntervalMs: 5000,
        logBufferSize: 100_000,
        clusterDisplayName: "Default Cluster",
        logLevel: null,
        clusters: data.clusters ?? [],
        rbacEnabled: false,
        prometheusEnabled: false,
        alertWebhookEnabled: false,
      }
      set({ config, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load config",
        loading: false,
      })
    }
  },
}))
