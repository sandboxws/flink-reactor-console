import { create } from "zustand"
import { parseLogBlock } from "@/data/log-parser"
import type { LogEntry, LogSource } from "@flink-reactor/ui"
import { LOG_BUFFER_LIMIT } from "@/lib/constants"
import {
  fetchJobManagerLog,
  fetchSQLGatewayLog,
  fetchTaskManagerLog,
} from "@/lib/graphql-api-client"
import { createClientLogger } from "@/lib/logger"
import { useClusterStore } from "./cluster-store"
import { useErrorStore } from "./error-store"

const log = createClientLogger().getSubLogger({ name: "store:log" })

/**
 * Log store — buffered log entries with FIFO eviction and streaming controls.
 *
 * Polls JM, TM, and SQL Gateway log endpoints from the Go backend using
 * byte-offset delta tracking (only new content is parsed each tick). Entries
 * exceeding {@link LOG_BUFFER_LIMIT} are evicted oldest-first. Exception
 * entries are cross-posted to the error-store for automatic grouping.
 *
 * @module log-store
 */

/** Speed multiplier → polling interval in ms. Lower speed = longer interval. */
function speedToIntervalMs(speed: number): number {
  // speed 0.5 → 5000ms, speed 1 → 3000ms, speed 2 → 1500ms, speed 4 → 750ms
  return Math.max(500, Math.round(3000 / speed))
}

/** Max concurrent TM log fetches to avoid request spikes. */
const TM_CONCURRENCY_CAP = 5

interface LogState {
  /** Ring buffer of parsed log entries (capped at LOG_BUFFER_LIMIT). */
  entries: LogEntry[]
  /** Whether the log polling loop is currently active. */
  isStreaming: boolean
  /** Speed multiplier controlling the polling interval (1 = 3s, 2 = 1.5s, etc.). */
  streamSpeed: number
}

interface LogActions {
  /** Append new entries to the buffer with FIFO eviction beyond the cap. */
  appendEntries: (newEntries: LogEntry[]) => void
  /** Clear all buffered log entries. */
  clear: () => void
  /** Toggle streaming on/off. */
  toggleStreaming: () => void
  /** Change the polling speed multiplier (restarts the interval if streaming). */
  setStreamSpeed: (speed: number) => void
  /** Start the log polling loop (resets byte offsets for a fresh stream). */
  startStreaming: () => void
  /** Stop the log polling loop. */
  stopStreaming: () => void
}

export type LogStore = LogState & LogActions

// ---------------------------------------------------------------------------
// Live polling state (module-scoped, outside Zustand)
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false
const lastOffset: Record<string, number> = {}

/** JM log source identifier. */
const JM_SOURCE: LogSource = {
  type: "jobmanager",
  id: "jobmanager",
  label: "JobManager",
}

/** SQL Gateway log source identifier. */
const SGW_SOURCE: LogSource = {
  type: "sqlgateway",
  id: "sqlgateway",
  label: "SQL Gateway",
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
  if (polling) return // skip if a poll is already in flight
  polling = true

  try {
    const allEntries: LogEntry[] = []

    // Always poll JM log
    const jmEntries = await fetchAndParseDelta(
      () => fetchJobManagerLog(),
      "jm",
      JM_SOURCE,
    )
    allEntries.push(...jmEntries)

    // Poll SQL Gateway log (silently skips if not available)
    const sgwEntries = await fetchAndParseDelta(
      () => fetchSQLGatewayLog(),
      "sgw",
      SGW_SOURCE,
    )
    allEntries.push(...sgwEntries)

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

      // Feed exceptions from the log stream into the error store
      const { processEntry } = useErrorStore.getState()
      for (const entry of allEntries) {
        if (entry.isException) {
          processEntry(entry)
        }
      }
    }
  } finally {
    polling = false
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
    for (const key of Object.keys(lastOffset)) {
      delete lastOffset[key]
    }
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

    // Update live polling interval
    if (pollTimer) {
      clearInterval(pollTimer)
      const intervalMs = speedToIntervalMs(speed)
      pollTimer = setInterval(() => pollLogs(get().appendEntries), intervalMs)
    }
  },

  startStreaming: () => {
    if (get().isStreaming) return

    log.info("LIVE → polling JM/TM/SGW log endpoints", {
      screen: "Log Explorer",
    })

    // Run initial poll immediately, then set up interval
    pollLogs(get().appendEntries)
    const intervalMs = speedToIntervalMs(get().streamSpeed)
    pollTimer = setInterval(() => pollLogs(get().appendEntries), intervalMs)

    set({ isStreaming: true })
  },

  stopStreaming: () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    set({ isStreaming: false })
  },
}))
