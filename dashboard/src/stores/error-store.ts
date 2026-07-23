import { create } from "zustand"
import type { JobException } from "@flink-reactor/ui"
import type { ErrorGroup, LogEntry, LogSource } from "@flink-reactor/ui"
import { fetchJobDetail } from "@/lib/graphql-api-client"
import { createClientLogger } from "@/lib/logger"
import { useClusterStore } from "./cluster-store"

const log = createClientLogger().getSubLogger({ name: "store:error" })

/**
 * Error store — auto-groups exceptions by class + message prefix.
 *
 * Ingests log entries from the log-store (streamed JM/TM logs) and live
 * exceptions polled from Flink job detail exception history. Entries are
 * grouped by exception class + first 100 characters of the message, with
 * deduplication across polls to prevent double-counting.
 *
 * @module error-store
 */

/** Sort order for the error group list. */
type SortBy = "lastSeen" | "count" | "firstSeen"

interface ErrorState {
  /** Exception groups keyed by `exceptionClass|messagePrefix`. */
  groups: Map<string, ErrorGroup>
  /** Currently selected group ID in the error explorer UI. */
  selectedGroupId: string | null
  /** Current sort order for the group list. */
  sortBy: SortBy
}

interface ErrorActions {
  /** Ingest a log entry — creates or updates an exception group if applicable. */
  processEntry: (entry: LogEntry) => void
  /** Start polling Flink job detail endpoints for live exceptions (10s interval, 2 jobs/tick). */
  startLiveExceptionPolling: () => void
  /** Stop the live exception polling interval. */
  stopLiveExceptionPolling: () => void
  /** Select an error group for detail view. */
  selectGroup: (groupId: string | null) => void
  /** Change the sort order of the group list. */
  setSortBy: (sortBy: SortBy) => void
  /** Clear all groups and reset the deduplication set. */
  clear: () => void
}

export type ErrorStore = ErrorState & ErrorActions

/**
 * Recognize a Java exception class name (`org.foo.Bar` ending in
 * Exception/Error/Throwable). Captures: 1=class, 2=message (after `:`).
 *
 * The reluctant `(.*?)` for the class lets us anchor on the
 * `Exception|Error|Throwable` suffix even when nested types like
 * `Foo$Bar.BazException` appear.
 */
const EXCEPTION_CLASS_RE = /([\w.$]+(?:Exception|Error|Throwable))(?:\s*:\s*(.*))?$/

/**
 * Extract the most-meaningful exception class + message from a log entry.
 *
 * Flink's log4j layout puts the exception header on the same line as the
 * preceding log message, so parseLogBlock() captures it into `entry.message`
 * — `entry.stackTrace` then starts with the first `at ...` frame, NOT the
 * header. The original "first line of stackTrace" extractor was therefore
 * grouping by stack-frame text (e.g. "at org.apache.flink…") which is both
 * wrong-looking in the UI and over-shards groups that share a root cause.
 *
 * Lookup order, most specific first:
 *  1. The deepest `Caused by:` line in the stack trace — when wrapped
 *     exceptions exist, the bottom of the chain is the root cause.
 *  2. An exception-class pattern inside `entry.message` (handles
 *     "Caught exception: io.IOException: Connection refused" shapes).
 *  3. `entry.logger` if it itself is an Exception/Error/Throwable
 *     (Flink job exception poll path uses logger=exceptionName).
 *  4. The first non-`at` line of the stack trace (original behavior).
 *  5. Fallback: literal entry.message.
 */
function extractExceptionInfo(entry: LogEntry): {
  exceptionClass: string
  message: string
} {
  // 1. Caused by chain — deepest wins.
  if (entry.stackTrace) {
    const causedBy = entry.stackTrace
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("Caused by:"))
    const deepest = causedBy[causedBy.length - 1]
    if (deepest) {
      const m = deepest.replace(/^Caused by:\s*/, "").match(EXCEPTION_CLASS_RE)
      if (m)
        return { exceptionClass: m[1], message: (m[2] ?? "").trim() }
    }
  }

  // 2. Exception pattern inside message.
  if (entry.message) {
    const m = entry.message.match(EXCEPTION_CLASS_RE)
    if (m) return { exceptionClass: m[1], message: (m[2] ?? "").trim() }
  }

  // 3. Logger is the exception class itself (Flink JobException poll path).
  if (EXCEPTION_CLASS_RE.test(entry.logger)) {
    return { exceptionClass: entry.logger, message: entry.message ?? "" }
  }

  // 4. First non-`at` line in the stack trace.
  if (entry.stackTrace) {
    for (const raw of entry.stackTrace.split("\n")) {
      const line = raw.trim()
      if (!line || line.startsWith("at ") || line.startsWith("...")) continue
      const colonIdx = line.indexOf(":")
      const cls = colonIdx === -1 ? line : line.substring(0, colonIdx).trim()
      const msg = colonIdx === -1 ? "" : line.substring(colonIdx + 1).trim()
      return { exceptionClass: cls, message: msg }
    }
  }

  // 5. Last resort.
  return { exceptionClass: "Exception", message: entry.message ?? "" }
}

/** Build a group key from the extracted exception class + first 100 chars of message. */
function buildGroupKey(entry: LogEntry): string | null {
  if (!entry.isException || !entry.stackTrace) return null
  const { exceptionClass, message } = extractExceptionInfo(entry)
  return `${exceptionClass}|${message.substring(0, 100)}`
}

/** Append a log source to the list if its ID is not already present. */
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
    failureLabels: exc.failureLabels,
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
