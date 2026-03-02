import type { LogLevel } from "../shared/severity-badge"

/** Maps each log level to its Tokyo Night severity color. */
export const SEVERITY_COLORS: Record<LogLevel, string> = {
  TRACE: "#565f89",
  DEBUG: "#7aa2f7",
  INFO: "#7dcfff",
  WARN: "#e0af68",
  ERROR: "#f7768e",
}

/** Maximum number of log entries to retain in the buffer. */
export const LOG_BUFFER_LIMIT = 100_000

/** Maximum number of log entries to render in the virtual list. */
export const LOG_RENDER_LIMIT = 10_000

/** Default filter state — all levels enabled, no source filter. */
export const DEFAULT_LEVEL_FILTER: Record<LogLevel, boolean> = {
  TRACE: true,
  DEBUG: true,
  INFO: true,
  WARN: true,
  ERROR: true,
}

/** Timestamp display format options. */
export const TIMESTAMP_FORMATS = {
  full: "yyyy-MM-dd HH:mm:ss.SSS",
  time: "HH:mm:ss.SSS",
  short: "HH:mm:ss",
} as const
