/** Log entry and error grouping types for the Log Explorer and Error Explorer. */

/** Flink log severity level. */
export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"

/** Origin of a log entry — which Flink component produced it. */
export type LogSource = {
  type: "taskmanager" | "jobmanager" | "sqlgateway" | "client"
  /** Unique identifier of the source instance (e.g. TM container ID). */
  id: string
  /** Human-readable label (e.g. "TM-1", "JM"). */
  label: string
}

/** A single parsed log entry from a Flink component. */
export type LogEntry = {
  id: string
  timestamp: Date
  level: LogLevel
  /** Fully qualified logger name. */
  logger: string
  /** Shortened logger name (last segment). */
  loggerShort: string
  thread: string
  message: string
  source: LogSource
  /** Original unparsed log line. */
  raw: string
  /** Java stack trace if this entry is an exception, otherwise null. */
  stackTrace: string | null
  /** Whether this entry contains an exception stack trace. */
  isException: boolean
}

/** A group of related errors aggregated by exception class. */
export type ErrorGroup = {
  id: string
  /** Fully qualified exception class name. */
  exceptionClass: string
  /** Representative error message. */
  message: string
  /** Total number of occurrences. */
  count: number
  firstSeen: Date
  lastSeen: Date
  /** Timestamps of each occurrence. */
  occurrences: Date[]
  /** A representative log entry from this group. */
  sampleEntry: LogEntry
  /** Sources (TM/JM instances) where this error was seen. */
  affectedSources: LogSource[]
}

/** State of the in-log search feature (query, matches, navigation). */
export type SearchState = {
  query: string
  isRegex: boolean
  /** IDs of log entries matching the search. */
  matchIds: string[]
  /** Index of the currently focused match. */
  currentMatchIndex: number
}
