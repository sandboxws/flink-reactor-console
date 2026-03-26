import { create } from "zustand"
import { fetchDashboardConfig } from "@/lib/graphql-api-client"

/**
 * Config store — runtime dashboard configuration fetched once from the Go
 * server's GraphQL `dashboardConfig` query.
 *
 * The config is fetched on app boot and cached — subsequent calls are no-ops.
 * Other stores (e.g. cluster-store) read `pollIntervalMs` from here to
 * configure their refresh intervals.
 *
 * @module config-store
 */

/**
 * Browser-safe config subset sourced from the Go server's GraphQL
 * dashboardConfig query (which returns clusters + instruments) with sensible
 * defaults for the remaining fields.
 */
export interface PublicDashboardConfig {
  /** Cluster polling interval in milliseconds (default: 5000). */
  pollIntervalMs: number
  /** Maximum number of log entries kept in the ring buffer (default: 100,000). */
  logBufferSize: number
  /** Human-readable display name for the cluster. */
  clusterDisplayName: string
  /** Server-side log level override, or null for default. */
  logLevel: string | null
  /** List of cluster endpoint names available to the dashboard. */
  clusters: string[]
  /** Whether role-based access control is enabled on the server. */
  rbacEnabled: boolean
  /** Whether Prometheus metric scraping is enabled. */
  prometheusEnabled: boolean
  /** Whether the alert webhook endpoint is configured. */
  alertWebhookEnabled: boolean
}

interface ConfigState {
  /** Resolved config, or null if not yet fetched. */
  config: PublicDashboardConfig | null
  /** Whether the config fetch is in progress. */
  loading: boolean
  /** Error message from the most recent failed fetch. */
  error: string | null
}

interface ConfigActions {
  /** Fetch config from GraphQL (guarded — subsequent calls are no-ops once loaded). */
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
