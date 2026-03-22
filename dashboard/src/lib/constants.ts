import type { LogLevel } from "@flink-reactor/ui"

/** Maps each log level to its CSS variable-based severity color. */
export const SEVERITY_COLORS: Record<LogLevel, string> = {
  TRACE: "var(--color-log-trace)",
  DEBUG: "var(--color-log-debug)",
  INFO: "var(--color-log-info)",
  WARN: "var(--color-log-warn)",
  ERROR: "var(--color-log-error)",
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
