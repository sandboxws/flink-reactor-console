import type { LogLevel } from "@/data/types";

const LEVEL_BG: Record<LogLevel, string> = {
  TRACE: "bg-log-trace/20 text-log-trace",
  DEBUG: "bg-log-debug/20 text-log-debug",
  INFO: "bg-log-info/20 text-log-info",
  WARN: "bg-log-warn/20 text-log-warn",
  ERROR: "bg-log-error/20 text-log-error",
};

export function SeverityBadge({ level }: { level: LogLevel }) {
  return <span className={`severity-badge ${LEVEL_BG[level]}`}>{level}</span>;
}
