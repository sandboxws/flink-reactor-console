/**
 * Recent alerts card — top-4 active alerts with `<StatusIcon>` and severity
 * letter pair (CR/WA/IN). Each row links to `/hub/monitoring/alerts`.
 *
 * Severity tint: critical → rose, warning → coral, info → amber. State
 * (acknowledged vs firing) drives the StatusIcon ring.
 */

import { StatusIcon, type StatusIconState } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import type { ActiveAlert } from "@/stores/alerts-store"

interface RecentAlertsCardProps {
  alerts: ActiveAlert[]
  /** Number to render — defaults to 4 to match the mockup. */
  limit?: number
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentAlertsCard({ alerts, limit = 4 }: RecentAlertsCardProps) {
  return (
    <div className="glass-card-static p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-heading">Recent alerts</h3>
        <Link
          to="/hub/monitoring/alerts"
          className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
        >
          VIEW ALL
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="text-[11px] text-fg-faint font-mono">No active alerts.</p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, limit).map((alert) => {
            const state: StatusIconState = alert.acknowledged
              ? "acknowledged"
              : "firing"
            const sevClass =
              alert.severity === "critical"
                ? "text-fr-rose"
                : alert.severity === "warning"
                  ? "text-fr-coral"
                  : "text-fr-amber"
            const sevLabel = alert.severity.toUpperCase().slice(0, 2)
            return (
              <Link
                key={alert.id}
                to="/hub/monitoring/alerts"
                className="block rounded-md p-2 hover:bg-dash-elevated/40"
              >
                <div className="flex items-start gap-2">
                  <StatusIcon state={state} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-fg leading-snug">
                      {alert.message}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-fg-faint">
                      <span className={sevClass}>{sevLabel}</span>
                      <span>·</span>
                      <span>{timeAgo(alert.triggeredAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
