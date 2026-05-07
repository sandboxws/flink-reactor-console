/**
 * Single Linear-style alert row.
 *
 * Renders priority bars + status icon + short id + title + label-chip + meta
 * (timestamp / ack info) + avatar. Matches `console-v2/alerts.html .issue-row`.
 */

import {
  PriorityBars,
  type PriorityLevel,
  StatusIcon,
  type StatusIconState,
} from "@flink-reactor/ui"
import type { ActiveAlert } from "@/stores/alerts-store"

const SEVERITY_TO_PRIORITY: Record<ActiveAlert["severity"], PriorityLevel> = {
  critical: "urgent",
  warning: "high",
  info: "low",
}

const SEVERITY_TO_LABEL = {
  critical: "P1",
  warning: "P2",
  info: "P3",
} as const

const SEVERITY_TO_CLASSES: Record<ActiveAlert["severity"], string> = {
  critical: "text-fr-rose bg-fr-rose/10 border-fr-rose/25",
  warning: "text-fr-coral bg-fr-coral/10 border-fr-coral/25",
  info: "text-fr-amber bg-fr-amber/10 border-fr-amber/25",
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function shortId(id: string): string {
  return `ALR-${id.slice(0, 4).toUpperCase()}`
}

interface AlertRowProps {
  alert: ActiveAlert
  /** When supplied, the row delegates click handling to a parent (e.g. selection). */
  onClick?: (alert: ActiveAlert) => void
}

export function AlertRow({ alert, onClick }: AlertRowProps) {
  const status: StatusIconState = alert.acknowledged ? "acknowledged" : "firing"
  const priority = SEVERITY_TO_PRIORITY[alert.severity]
  const sevLabel = SEVERITY_TO_LABEL[alert.severity]
  const sevClass = SEVERITY_TO_CLASSES[alert.severity]

  return (
    <button
      type="button"
      className="issue-row w-full text-left"
      onClick={onClick ? () => onClick(alert) : undefined}
    >
      <PriorityBars level={priority} />
      <StatusIcon state={status} />
      <span className="id">{shortId(alert.id)}</span>
      <span className="title">{alert.message}</span>
      <span className={`label-chip border ${sevClass}`}>
        {sevLabel} · {alert.ruleName}
      </span>
      <span className="meta">{timeAgo(alert.triggeredAt)}</span>
      <span className="text-fg-faint text-[11px]">—</span>
    </button>
  )
}
