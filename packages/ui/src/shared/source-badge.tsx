/** Data source indicator badge showing the origin of a log entry or metric. */
"use client"

/** Describes the source of a log entry (e.g. jobmanager, taskmanager, client). */
export interface LogSource {
  type: string
  id: string
  label?: string
}

const SHORT_LABELS: Record<string, string> = {
  jobmanager: "JM",
  taskmanager: "TM",
  client: "CLI",
}

/** Props for the SourceBadge component. */
export interface SourceBadgeProps {
  source: LogSource
}

/** Badge showing the origin of a log entry, with automatic abbreviation (JM, TM-1, CLI). */
export function SourceBadge({ source }: SourceBadgeProps) {
  const short = SHORT_LABELS[source.type] ?? source.type
  // For TMs, append the numeric part of the id (e.g. "TM-1")
  const label =
    source.type === "taskmanager"
      ? `${short}-${source.id.replace(/\D/g, "") || source.id}`
      : short

  return (
    <span className="source-badge border border-fr-purple/20 text-fr-purple/70">
      {label}
    </span>
  )
}
