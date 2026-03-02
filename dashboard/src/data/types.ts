export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"

export type LogSource = {
  type: "taskmanager" | "jobmanager" | "client"
  id: string
  label: string
}

export type LogEntry = {
  id: string
  timestamp: Date
  level: LogLevel
  logger: string
  loggerShort: string
  thread: string
  message: string
  source: LogSource
  raw: string
  stackTrace: string | null
  isException: boolean
}

export type ErrorGroup = {
  id: string
  exceptionClass: string
  message: string
  count: number
  firstSeen: Date
  lastSeen: Date
  occurrences: Date[]
  sampleEntry: LogEntry
  affectedSources: LogSource[]
}

export type SearchState = {
  query: string
  isRegex: boolean
  matchIds: string[]
  currentMatchIndex: number
}
