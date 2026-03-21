"use client"

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import type { HealthIssue } from "../../types"

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    iconClass: "text-job-failed",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-fr-amber",
  },
  info: {
    icon: Info,
    iconClass: "text-log-info",
  },
} as const

function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m ago`
}

export interface TopIssuesListProps {
  issues: HealthIssue[]
  maxItems?: number
}

export function TopIssuesList({
  issues,
  maxItems = 10,
}: TopIssuesListProps) {
  const visible = issues.slice(0, maxItems)
  const remaining = issues.length - maxItems

  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Active Issues
      </h3>

      {issues.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
          <CheckCircle2 className="size-5 text-job-running" />
          <span>No issues detected</span>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((issue) => {
            const config = SEVERITY_CONFIG[issue.severity]
            const SeverityIcon = config.icon

            return (
              <div
                key={issue.id}
                className="flex items-center gap-3 rounded-md bg-white/[0.02] px-3 py-2"
              >
                <SeverityIcon
                  className={`size-4 shrink-0 ${config.iconClass}`}
                />
                <span className="flex-1 text-xs text-zinc-300">
                  {issue.message}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  {issue.source}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {formatRelativeTime(issue.timestamp)}
                </span>
              </div>
            )
          })}
          {remaining > 0 && (
            <p className="px-3 text-xs text-zinc-600">and {remaining} more...</p>
          )}
        </div>
      )}
    </div>
  )
}
