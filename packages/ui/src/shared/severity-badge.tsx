"use client"

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"

const LEVEL_BG: Record<LogLevel, string> = {
  TRACE: "bg-log-trace/20 text-log-trace",
  DEBUG: "bg-log-debug/20 text-log-debug",
  INFO: "bg-log-info/20 text-log-info",
  WARN: "bg-log-warn/20 text-log-warn",
  ERROR: "bg-log-error/20 text-log-error",
}

export interface SeverityBadgeProps {
  level: LogLevel
}

/**
 * SeverityBadge — colored badge for log severity levels.
 *
 * Uses the Tokyo Night color palette defined in tokens.css.
 */
export function SeverityBadge({ level }: SeverityBadgeProps) {
  return <span className={`severity-badge ${LEVEL_BG[level]}`}>{level}</span>
}
