/** Log severity level badge — color-coded label for DEBUG/INFO/WARN/ERROR/FATAL. */
"use client"

/** Supported log severity levels. */
export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"

const LEVEL_BG: Record<LogLevel, string> = {
  TRACE: "bg-log-trace/20 text-log-trace",
  DEBUG: "bg-log-debug/20 text-log-debug",
  INFO: "bg-log-info/20 text-log-info",
  WARN: "bg-log-warn/20 text-log-warn",
  ERROR: "bg-log-error/20 text-log-error",
}

/** Props for the SeverityBadge component. */
export interface SeverityBadgeProps {
  level: LogLevel
}

/** Colored badge for log severity levels, using the Tokyo Night color palette from tokens.css. */
export function SeverityBadge({ level }: SeverityBadgeProps) {
  return <span className={`severity-badge ${LEVEL_BG[level]}`}>{level}</span>
}
