import type {
  ThreadDumpEntry,
  ThreadInfoRaw,
  ThreadState,
} from "./cluster-types"

// ---------------------------------------------------------------------------
// Thread dump parser — converts Flink REST API threadInfos into structured
// ThreadDumpEntry objects.
//
// The API returns { threadInfos: [{ threadName, stringifiedThreadInfo }] }
// where stringifiedThreadInfo uses \t indentation and \n line breaks.
// ---------------------------------------------------------------------------

// Header: "thread-name" Id=N STATE [(in native)] [on lock]
const THREAD_HEADER_RE =
  /^"(.+)"\s+Id=(\d+)\s+(RUNNABLE|WAITING|TIMED_WAITING|BLOCKED|NEW|TERMINATED)(?:\s+\(in native\))?(?:\s+on\s+(.+))?$/

// Alternate: "thread-name" Id=N STATE [on lock] [(in native)]
const THREAD_HEADER_ALT_RE =
  /^"(.+)"\s+Id=(\d+)\s+(RUNNABLE|WAITING|TIMED_WAITING|BLOCKED|NEW|TERMINATED)(?:\s+on\s+(.+?))?(?:\s+\(in native\))?$/

const LOCKED_SYNC_HEADER_RE = /^\s*Number of locked synchronizers\s*=\s*(\d+)/
const LOCKED_SYNC_ENTRY_RE = /^\s*-\s+(.+)$/
const FRAME_LINE_RE = /^\s+at\s+/
const ANNOTATION_LINE_RE = /^\s+-\s+/

/**
 * Parse a single stringifiedThreadInfo block into a ThreadDumpEntry.
 * Each block has a header line followed by tab-indented frames and annotations.
 */
export function parseThreadInfo(info: string): ThreadDumpEntry | null {
  const lines = info.split("\n")
  let entry: ThreadDumpEntry | null = null
  let inSyncSection = false

  for (const line of lines) {
    if (!entry) {
      // First non-empty line should be the header
      if (line.trim() === "") continue
      const headerMatch =
        line.match(THREAD_HEADER_RE) ?? line.match(THREAD_HEADER_ALT_RE)
      if (headerMatch) {
        entry = {
          name: headerMatch[1],
          id: Number(headerMatch[2]),
          state: headerMatch[3] as ThreadState,
          lockObject: headerMatch[4] ?? null,
          isNative: line.includes("(in native)"),
          stackFrames: [],
          lockedSynchronizers: [],
        }
      }
      continue
    }

    // Check for locked synchronizers header
    const syncMatch = line.match(LOCKED_SYNC_HEADER_RE)
    if (syncMatch) {
      inSyncSection = true
      continue
    }

    // If in synchronizers section, collect entries
    if (inSyncSection) {
      const syncEntry = line.match(LOCKED_SYNC_ENTRY_RE)
      if (syncEntry) {
        entry.lockedSynchronizers.push(syncEntry[1])
        continue
      }
      if (line.trim() === "") continue
      inSyncSection = false
    }

    // Stack frame line
    if (FRAME_LINE_RE.test(line)) {
      entry.stackFrames.push(line.trim())
      continue
    }

    // Lock annotation line (- waiting on / - locked)
    if (ANNOTATION_LINE_RE.test(line) && !inSyncSection) {
      entry.stackFrames.push(line.trim())
    }
  }

  return entry
}

/**
 * Parse the full API response threadInfos array into ThreadDumpEntry objects.
 */
export function parseThreadInfos(
  threadInfos: ThreadInfoRaw[],
): ThreadDumpEntry[] {
  const entries: ThreadDumpEntry[] = []
  for (const info of threadInfos) {
    const entry = parseThreadInfo(info.stringifiedThreadInfo)
    if (entry) entries.push(entry)
  }
  return entries
}
