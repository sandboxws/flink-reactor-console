/**
 * Activity feed — recent events composed by the parent from completed jobs,
 * deployments, and alerts. Each row optionally has a `to` route — rows with
 * `to` render as TanStack Router `<Link>`s, rows without as static `<div>`s
 * (matches the mockup, where some rows are not navigable).
 */

import { Link } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

export type ActivityIconColor = "sage" | "coral" | "amber" | "rose" | "teal"

export interface ActivityRow {
  iconColor: ActivityIconColor
  icon: LucideIcon
  text: React.ReactNode
  time: string
  /** Optional destination — when set, the row renders as a navigable Link. */
  to?: string
  /** Path params for the Link's `to` route. */
  params?: Record<string, string>
}

interface ActivityFeedProps {
  rows: ActivityRow[]
  /** Path of the "VIEW ALL" link in the header. Defaults to `/hub/logs`. */
  viewAllTo?: string
}

const COLOR_CLASS: Record<ActivityIconColor, string> = {
  sage: "text-fr-sage",
  coral: "text-fr-coral",
  amber: "text-fr-amber",
  rose: "text-fr-rose",
  teal: "text-fr-teal",
}

export function ActivityFeed({ rows, viewAllTo = "/hub/logs" }: ActivityFeedProps) {
  return (
    <div className="glass-card-static p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-heading">Recent activity</h3>
        <Link
          to={viewAllTo}
          className="text-[10px] text-fg-faint hover:text-fr-coral font-mono"
        >
          VIEW ALL
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-fg-faint font-mono">No recent activity.</p>
      ) : (
        <div className="divide-y divide-dash-border/40">
          {rows.map((row, i) => {
            const Icon = row.icon
            const colorClass = COLOR_CLASS[row.iconColor]
            const inner = (
              <>
                <div className={`activity-icon ${colorClass}`}>
                  <Icon />
                </div>
                <div className="activity-text">{row.text}</div>
                <div className="activity-time">{row.time}</div>
              </>
            )
            if (row.to) {
              return (
                <Link
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional row
                  key={i}
                  to={row.to}
                  params={row.params as never}
                  className="activity-entry hover:bg-dash-elevated/40"
                >
                  {inner}
                </Link>
              )
            }
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional row
              <div key={i} className="activity-entry">
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
