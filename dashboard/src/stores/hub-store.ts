import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Hub UI store — selected cluster + command palette state for the Hub
 * shell. Kept separate from `cluster-store` (which manages a single
 * cluster's data) and `ui-store` (legacy chrome state).
 *
 * @module hub-store
 */

interface HubState {
  selectedCluster: string | null
  commandPaletteOpen: boolean
}

interface HubActions {
  setSelectedCluster: (name: string) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleCommandPalette: () => void
}

export type HubStore = HubState & HubActions

export const useHubStore = create<HubStore>()(
  persist(
    (set) => ({
      selectedCluster: null,
      commandPaletteOpen: false,

      setSelectedCluster: (name) => {
        set({ selectedCluster: name })
      },
      openCommandPalette: () => {
        set({ commandPaletteOpen: true })
      },
      closeCommandPalette: () => {
        set({ commandPaletteOpen: false })
      },
      toggleCommandPalette: () => {
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen }))
      },
    }),
    {
      name: "fr-hub-ui",
      partialize: (s) => ({ selectedCluster: s.selectedCluster }),
    },
  ),
)

/** Naive env detection from cluster name. Real multi-cluster routing
 *  is a follow-up; this is a visual-only inference today. */
export function clusterEnv(name: string): "prod" | "stage" | "dev" {
  const lower = name.toLowerCase()
  if (lower.includes("prod") || lower.includes("production")) return "prod"
  if (
    lower.includes("stage") ||
    lower.includes("staging") ||
    lower.includes("preview")
  )
    return "stage"
  return "dev"
}
