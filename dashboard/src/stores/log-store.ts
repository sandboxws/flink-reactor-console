import { create } from "zustand"
import { parseLogBlock } from "@/data/log-parser"
import { createMockGenerator, type MockGenerator } from "@/data/mock-generator"
import type { LogEntry, LogSource } from "@/data/types"
import { LOG_BUFFER_LIMIT } from "@/lib/constants"
import {
  fetchJobManagerLog,
  fetchTaskManagerLog,
} from "@/lib/graphql-api-client"
import { createClientLogger } from "@/lib/logger"
import { useClusterStore } from "./cluster-store"
import { useConfigStore } from "./config-store"

const log = createClientLogger().getSubLogger({ name: "store:log" })

// ---------------------------------------------------------------------------
// Log store — buffered log entries with FIFO eviction and streaming controls
// Supports mock streaming (mock-generator) and live polling (Flink REST).
// ---------------------------------------------------------------------------

/** Speed multiplier → polling interval in ms. Lower speed = longer interval. */
function speedToIntervalMs(speed: number): number {
  // speed 0.5 → 5000ms, speed 1 → 3000ms, speed 2 → 1500ms, speed 4 → 750ms
  return Math.max(500, Math.round(3000 / speed))
}

/** Max concurrent TM log fetches to avoid request spikes. */
const TM_CONCURRENCY_CAP = 5

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

// ---------------------------------------------------------------------------
// Mock generator (unchanged behavior)
// ---------------------------------------------------------------------------

let generator: MockGenerator | null = null

function getGenerator(
  appendEntries: (entries: LogEntry[]) => void,
): MockGenerator {
  if (!generator) {
    generator = createMockGenerator(appendEntries)
  }
  return generator
}

// ---------------------------------------------------------------------------
// Live polling state (module-scoped, outside Zustand)
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setInterval> | null = null
const lastOffset: Record<string, number> = {}

/** JM log source identifier. */
const JM_SOURCE: LogSource = {
  type: "jobmanager",
  id: "jobmanager",
  label: "JobManager",
}

/** Build a TM log source from its ID. Label matches SourceBadge format. */
function tmSource(tmId: string): LogSource {
  const digits = tmId.replace(/\D/g, "")
  return {
    type: "taskmanager",
    id: tmId,
    label: `TM-${digits || tmId}`,
  }
}

/**
 * Fetch and parse new log content for a single source.
 * Uses byte-offset tracking to only parse the delta.
 * Handles log rotation (new length < last offset → reset).
 */
async function fetchAndParseDelta(
  fetcher: () => Promise<string>,
  sourceKey: string,
  source: LogSource,
): Promise<LogEntry[]> {
  try {
    const text = await fetcher()
    const prevOffset = lastOffset[sourceKey] ?? 0

    if (text.length < prevOffset) {
      // Log rotation detected — reset and parse full content
      log.debug("log rotation detected, resetting offset", {
        source: sourceKey,
      })
      lastOffset[sourceKey] = text.length
      const { entries } = parseLogBlock(text, source)
      return entries
    }

    if (text.length === prevOffset) {
      // No new content
      return []
    }

    // Parse only the new delta
    const delta = text.substring(prevOffset)
    lastOffset[sourceKey] = text.length
    const { entries } = parseLogBlock(delta, source)
    return entries
  } catch (err) {
    log.warn("failed to fetch log", { source: sourceKey, error: String(err) })
    return []
  }
}

/**
 * Run tasks with a concurrency limit.
 * Each task is a function that returns a Promise<T>.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = []
  let idx = 0

  async function next(): Promise<void> {
    while (idx < tasks.length) {
      const currentIdx = idx++
      results[currentIdx] = await tasks[currentIdx]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    next(),
  )
  await Promise.all(workers)
  return results
}

/** Execute a single poll cycle: fetch JM + all TM logs, parse deltas. */
async function pollLogs(appendEntries: (entries: LogEntry[]) => void) {
  const allEntries: LogEntry[] = []

  // Always poll JM log
  const jmEntries = await fetchAndParseDelta(
    () => fetchJobManagerLog(),
    "jm",
    JM_SOURCE,
  )
  allEntries.push(...jmEntries)

  // Poll TM logs (IDs from cluster-store)
  const tms = useClusterStore.getState().taskManagers
  if (tms.length > 0) {
    const tmTasks = tms.map(
      (tm) => () =>
        fetchAndParseDelta(
          () => fetchTaskManagerLog(tm.id),
          `tm:${tm.id}`,
          tmSource(tm.id),
        ),
    )

    const tmResults = await runWithConcurrency(tmTasks, TM_CONCURRENCY_CAP)
    for (const entries of tmResults) {
      allEntries.push(...entries)
    }
  }

  if (allEntries.length > 0) {
    // Sort by timestamp before appending
    allEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    appendEntries(allEntries)
  }
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

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

    // Update mock generator speed
    if (generator) {
      generator.setSpeed(speed)
    }

    // Update live polling interval
    if (pollTimer) {
      clearInterval(pollTimer)
      const intervalMs = speedToIntervalMs(speed)
      pollTimer = setInterval(() => pollLogs(get().appendEntries), intervalMs)
    }
  },

  startStreaming: () => {
    const mockMode = useConfigStore.getState().config?.mockMode ?? true

    if (mockMode) {
      // Mock mode: use existing mock generator
      log.info("MOCK → createMockGenerator streaming", {
        screen: "Log Explorer",
        file: "mock-generator.ts",
        generator: "createMockGenerator",
      })
      const gen = getGenerator(get().appendEntries)
      gen.setSpeed(get().streamSpeed)
      gen.start()
    } else {
      // Live mode: poll Flink REST log endpoints
      log.info("LIVE → polling JM/TM log endpoints", { screen: "Log Explorer" })
      // Reset offsets on fresh start
      for (const key of Object.keys(lastOffset)) {
        delete lastOffset[key]
      }

      // Run initial poll immediately, then set up interval
      pollLogs(get().appendEntries)
      const intervalMs = speedToIntervalMs(get().streamSpeed)
      pollTimer = setInterval(() => pollLogs(get().appendEntries), intervalMs)
    }

    set({ isStreaming: true })
  },

  stopStreaming: () => {
    // Stop mock generator
    if (generator) {
      generator.stop()
    }

    // Stop live polling
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    set({ isStreaming: false })
  },
}))
