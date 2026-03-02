import type { LogEntry, LogLevel, LogSource } from "@/data/types"

// ---------------------------------------------------------------------------
// Flink log4j pattern:
//   %d{yyyy-MM-dd HH:mm:ss,SSS} %-5p %-60c %x - %m%n
//
// Example:
//   2025-01-15 14:23:45,123 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor           - Received task ...
// ---------------------------------------------------------------------------

const LOG_LINE_RE =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(\S+)\s*(.*?)\s*-\s(.*)$/

const CAUSED_BY_RE = /^Caused by:\s/
const AT_FRAME_RE = /^\s+at\s/
const MORE_RE = /^\s+\.\.\.\s\d+\s+more$/

let entryCounter = 0

function nextId(): string {
  return `log-${++entryCounter}`
}

/** Extract the short logger name (last segment of a fully-qualified class name). */
function abbreviateLogger(fqcn: string): string {
  const lastDot = fqcn.lastIndexOf(".")
  return lastDot === -1 ? fqcn : fqcn.substring(lastDot + 1)
}

/** Parse a Flink log4j timestamp string into a Date. */
function parseTimestamp(ts: string): Date {
  // "2025-01-15 14:23:45,123" → "2025-01-15T14:23:45.123"
  return new Date(ts.replace(" ", "T").replace(",", "."))
}

/** Check if a line is part of a stack trace continuation. */
function isStackTraceLine(line: string): boolean {
  return AT_FRAME_RE.test(line) || CAUSED_BY_RE.test(line) || MORE_RE.test(line)
}

export interface ParseResult {
  entries: LogEntry[]
  /** Lines that couldn't be attached to any log entry. */
  orphanLines: string[]
}

/**
 * Parse a block of Flink log text into structured LogEntry objects.
 *
 * Handles multi-line entries (stack traces), "Caused by" chains,
 * "... N more" truncation markers, and orphan continuation lines.
 */
export function parseLogBlock(text: string, source: LogSource): ParseResult {
  const lines = text.split("\n")
  const entries: LogEntry[] = []
  const orphanLines: string[] = []

  let currentEntry: LogEntry | null = null
  let stackLines: string[] = []

  function flushCurrent() {
    if (currentEntry) {
      if (stackLines.length > 0) {
        currentEntry.stackTrace = stackLines.join("\n")
        currentEntry.isException = true
      }
      entries.push(currentEntry)
      currentEntry = null
      stackLines = []
    }
  }

  for (const line of lines) {
    if (line === "") continue

    const match = LOG_LINE_RE.exec(line)

    if (match) {
      // New log header — flush previous entry
      flushCurrent()

      const [, timestamp, level, logger, thread, message] = match
      currentEntry = {
        id: nextId(),
        timestamp: parseTimestamp(timestamp),
        level: level as LogLevel,
        logger,
        loggerShort: abbreviateLogger(logger),
        thread: thread.trim() || "main",
        message,
        source,
        raw: line,
        stackTrace: null,
        isException: false,
      }
    } else if (currentEntry && isStackTraceLine(line)) {
      // Stack trace continuation of current entry
      stackLines.push(line)
      currentEntry.raw += `\n${line}`
    } else if (currentEntry) {
      // Non-stack-trace continuation (e.g. multi-line message)
      currentEntry.message += `\n${line}`
      currentEntry.raw += `\n${line}`
    } else {
      // Orphan line — no preceding log header
      orphanLines.push(line)
    }
  }

  // Flush the last entry
  flushCurrent()

  return { entries, orphanLines }
}

/**
 * Parse a single pre-structured log entry (used by the mock generator
 * which already knows the fields, but needs a LogEntry object).
 */
export function buildLogEntry(params: {
  timestamp: Date
  level: LogLevel
  logger: string
  thread: string
  message: string
  source: LogSource
  stackTrace?: string | null
}): LogEntry {
  const loggerShort = abbreviateLogger(params.logger)
  const ts = formatTimestamp(params.timestamp)
  const levelPad = params.level.padEnd(5)
  const loggerPad = params.logger.padEnd(60)
  const threadPart = params.thread ? ` ${params.thread}` : ""

  let raw = `${ts} ${levelPad} ${loggerPad}${threadPart} - ${params.message}`
  if (params.stackTrace) {
    raw += `\n${params.stackTrace}`
  }

  return {
    id: nextId(),
    timestamp: params.timestamp,
    level: params.level,
    logger: params.logger,
    loggerShort,
    thread: params.thread,
    message: params.message,
    source: params.source,
    raw,
    stackTrace: params.stackTrace ?? null,
    isException: params.stackTrace != null,
  }
}

/** Format a Date as Flink log4j timestamp. */
function formatTimestamp(d: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0")
  const pad3 = (n: number) => String(n).padStart(3, "0")
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())},${pad3(d.getMilliseconds())}`
}

/**
 * Reset the internal entry counter. Useful for testing.
 */
export function resetEntryCounter(): void {
  entryCounter = 0
}
