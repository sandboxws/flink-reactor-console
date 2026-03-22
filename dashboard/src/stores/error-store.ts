import { create } from "zustand"
import type { JobException } from "@flink-reactor/ui"
import type { ErrorGroup, LogEntry, LogSource } from "@flink-reactor/ui"
import { fetchJobDetail } from "@/lib/graphql-api-client"
import { createClientLogger } from "@/lib/logger"
import { useClusterStore } from "./cluster-store"

const log = createClientLogger().getSubLogger({ name: "store:error" })

// ---------------------------------------------------------------------------
// Error store — auto-groups exceptions by class + message prefix
// Supports mock-derived entries (from log-store) and live exceptions (from
// Flink job detail exception history).
// ---------------------------------------------------------------------------

type SortBy = "lastSeen" | "count" | "firstSeen"

interface ErrorState {
  groups: Map<string, ErrorGroup>
  selectedGroupId: string | null
  sortBy: SortBy
}

interface ErrorActions {
  processEntry: (entry: LogEntry) => void
  startLiveExceptionPolling: () => void
  stopLiveExceptionPolling: () => void
  selectGroup: (groupId: string | null) => void
  setSortBy: (sortBy: SortBy) => void
  clear: () => void
}

export type ErrorStore = ErrorState & ErrorActions

/** Build a group key from exception class + first 100 chars of message. */
function buildGroupKey(entry: LogEntry): string | null {
  if (!entry.isException || !entry.stackTrace) return null

  // Extract exception class from first line of stack trace
  const firstLine = entry.stackTrace.split("\n")[0]
  const colonIdx = firstLine.indexOf(":")
  const exceptionClass =
    colonIdx !== -1 ? firstLine.substring(0, colonIdx).trim() : firstLine.trim()
  const message =
    colonIdx !== -1 ? firstLine.substring(colonIdx + 1).trim() : ""

  return `${exceptionClass}|${message.substring(0, 100)}`
}

function extractExceptionInfo(entry: LogEntry): {
  exceptionClass: string
  message: string
} {
  if (!entry.stackTrace) return { exceptionClass: "Unknown", message: "" }

  const firstLine = entry.stackTrace.split("\n")[0]
  const colonIdx = firstLine.indexOf(":")
  const exceptionClass =
    colonIdx !== -1 ? firstLine.substring(0, colonIdx).trim() : firstLine.trim()
  const message =
    colonIdx !== -1 ? firstLine.substring(colonIdx + 1).trim() : ""

  return { exceptionClass, message }
}

function addSourceIfNew(existing: LogSource[], source: LogSource): LogSource[] {
  if (existing.some((s) => s.id === source.id)) return existing
  return [...existing, source]
}

let groupIdCounter = 0

// ---------------------------------------------------------------------------
// Live exception polling state (module-scoped)
// ---------------------------------------------------------------------------

let exceptionPollTimer: ReturnType<typeof setInterval> | null = null

/** Set of already-processed exception keys to prevent duplicates across polls. */
const processedExceptionKeys = new Set<string>()

/** Staggered fetch pointer — rotate through running jobs. */
let fetchPtr = 0

/** Convert a Flink JobException to a LogEntry for reuse in processEntry(). */
function jobExceptionToLogEntry(exc: JobException, jobId: string): LogEntry {
  const source: LogSource = {
    type: "jobmanager",
    id: `job:${jobId}`,
    label: `Job ${jobId.substring(0, 8)}`,
  }

  return {
    id: `exc-${++groupIdCounter}`,
    timestamp: exc.timestamp,
    level: "ERROR",
    logger: exc.name,
    loggerShort: exc.name.split(".").pop() ?? exc.name,
    thread: exc.taskName ?? "main",
    message: exc.message,
    source,
    raw: exc.stacktrace,
    stackTrace: exc.stacktrace,
    isException: true,
  }
}

/** Build a dedup key for an exception. */
function exceptionDedupeKey(jobId: string, exc: JobException): string {
  return `${jobId}:${exc.timestamp.getTime()}:${exc.name}`
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useErrorStore = create<ErrorStore>((set, get) => ({
  groups: new Map(),
  selectedGroupId: null,
  sortBy: "lastSeen",

  processEntry: (entry: LogEntry) => {
    const key = buildGroupKey(entry)
    if (!key) return

    set((state) => {
      const next = new Map(state.groups)
      const existing = next.get(key)

      if (existing) {
        next.set(key, {
          ...existing,
          count: existing.count + 1,
          lastSeen: entry.timestamp,
          occurrences: [...existing.occurrences, entry.timestamp],
          affectedSources: addSourceIfNew(
            existing.affectedSources,
            entry.source,
          ),
        })
      } else {
        const { exceptionClass, message } = extractExceptionInfo(entry)
        const group: ErrorGroup = {
          id: `err-group-${++groupIdCounter}`,
          exceptionClass,
          message,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          occurrences: [entry.timestamp],
          sampleEntry: entry,
          affectedSources: [entry.source],
        }
        next.set(key, group)
      }

      return { groups: next }
    })
  },

  startLiveExceptionPolling: () => {
    log.info("LIVE → polling job exceptions", { screen: "Error Explorer" })
    processedExceptionKeys.clear()
    fetchPtr = 0

    // Poll every 10s — fetch 2 running jobs per tick
    const pollExceptions = async () => {
      const runningJobs = useClusterStore.getState().runningJobs
      if (runningJobs.length === 0) return

      // Wrap pointer
      if (fetchPtr >= runningJobs.length) fetchPtr = 0

      // Fetch up to 2 jobs per tick
      const batch = runningJobs.slice(fetchPtr, fetchPtr + 2)
      fetchPtr = (fetchPtr + batch.length) % Math.max(1, runningJobs.length)

      const results = await Promise.allSettled(
        batch.map((job) => fetchJobDetail(job.id)),
      )

      for (const result of results) {
        if (result.status !== "fulfilled") continue
        const job = result.value
        if (!job.exceptions || job.exceptions.length === 0) continue

        for (const exc of job.exceptions) {
          const dedupeKey = exceptionDedupeKey(job.id, exc)
          if (processedExceptionKeys.has(dedupeKey)) continue
          processedExceptionKeys.add(dedupeKey)

          const entry = jobExceptionToLogEntry(exc, job.id)
          get().processEntry(entry)
        }
      }
    }

    // Initial poll
    pollExceptions()
    exceptionPollTimer = setInterval(pollExceptions, 10_000)
  },

  stopLiveExceptionPolling: () => {
    if (exceptionPollTimer) {
      clearInterval(exceptionPollTimer)
      exceptionPollTimer = null
    }
  },

  selectGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId })
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy })
  },

  clear: () => {
    set({ groups: new Map(), selectedGroupId: null })
    processedExceptionKeys.clear()
  },
}))
