import { create } from "zustand"
import { createMockGenerator, type MockGenerator } from "@/data/mock-generator"
import type { LogEntry } from "@/data/types"
import { LOG_BUFFER_LIMIT } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Log store — buffered log entries with FIFO eviction and streaming controls
// ---------------------------------------------------------------------------

interface LogState {
  entries: LogEntry[]
  isStreaming: boolean
  streamSpeed: number
}

interface LogActions {
  appendEntries: (newEntries: LogEntry[]) => void
  clear: () => void
  toggleStreaming: () => void
  setStreamSpeed: (speed: number) => void
  startStreaming: () => void
  stopStreaming: () => void
}

export type LogStore = LogState & LogActions

let generator: MockGenerator | null = null

function getGenerator(
  appendEntries: (entries: LogEntry[]) => void,
): MockGenerator {
  if (!generator) {
    generator = createMockGenerator(appendEntries)
  }
  return generator
}

export const useLogStore = create<LogStore>((set, get) => ({
  entries: [],
  isStreaming: false,
  streamSpeed: 1,

  appendEntries: (newEntries: LogEntry[]) => {
    set((state) => {
      const combined = [...state.entries, ...newEntries]
      // FIFO eviction: drop oldest entries beyond the cap
      const start = Math.max(0, combined.length - LOG_BUFFER_LIMIT)
      return { entries: combined.slice(start) }
    })
  },

  clear: () => {
    set({ entries: [] })
  },

  toggleStreaming: () => {
    const { isStreaming } = get()
    if (isStreaming) {
      get().stopStreaming()
    } else {
      get().startStreaming()
    }
  },

  setStreamSpeed: (speed: number) => {
    set({ streamSpeed: speed })
    if (generator) {
      generator.setSpeed(speed)
    }
  },

  startStreaming: () => {
    const gen = getGenerator(get().appendEntries)
    gen.setSpeed(get().streamSpeed)
    gen.start()
    set({ isStreaming: true })
  },

  stopStreaming: () => {
    if (generator) {
      generator.stop()
    }
    set({ isStreaming: false })
  },
}))
