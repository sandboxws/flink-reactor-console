import { create } from "zustand"
import { fetchInstruments } from "@/lib/instruments/api"
import type { InstrumentInfo } from "@/lib/instruments/types"

// ---------------------------------------------------------------------------
// Instrument store
// ---------------------------------------------------------------------------

interface InstrumentState {
  instruments: InstrumentInfo[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface InstrumentActions {
  fetchInstruments: () => Promise<void>
  getInstrument: (name: string) => InstrumentInfo | undefined
}

export type InstrumentStore = InstrumentState & InstrumentActions

let initialized = false

export const useInstrumentStore = create<InstrumentStore>((set, get) => ({
  instruments: [],
  loading: false,
  error: null,
  lastUpdated: null,

  fetchInstruments: async () => {
    if (initialized && get().instruments.length > 0) {
      // Refresh path — don't show loading spinner
      try {
        const data = await fetchInstruments()
        set({ instruments: data, error: null, lastUpdated: new Date() })
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "Failed to fetch instruments",
        })
      }
      return
    }

    initialized = true
    set({ loading: true, error: null })

    try {
      const data = await fetchInstruments()
      set({
        instruments: data,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      set({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch instruments",
      })
    }
  },

  getInstrument: (name: string) => {
    return get().instruments.find((i) => i.name === name)
  },
}))
