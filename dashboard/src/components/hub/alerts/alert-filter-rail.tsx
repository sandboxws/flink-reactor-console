/**
 * Linear-style filter chip rail for the alerts page.
 *
 * Supports per-axis toggling (status / severity) without locking to a single
 * value — clicking a chip narrows results, clicking again clears that axis.
 * Returns the currently-active filter set up via callbacks so the page can
 * derive the visible alerts from the source list.
 */

import { PropChip } from "@flink-reactor/ui"
import { ArrowUpDown, Filter, Layers3, PlusCircle } from "lucide-react"
import type { AlertSeverity } from "@/stores/alerts-store"

export type AlertStatusFilter = "firing" | "acknowledged" | null
export type AlertSeverityFilter = AlertSeverity | null

interface AlertFilterRailProps {
  search: string
  onSearchChange: (next: string) => void
  status: AlertStatusFilter
  onStatusChange: (next: AlertStatusFilter) => void
  severity: AlertSeverityFilter
  onSeverityChange: (next: AlertSeverityFilter) => void
  groupBy: "status" | "severity"
  onGroupByChange: (next: "status" | "severity") => void
  sortDesc: boolean
  onSortToggle: () => void
}

export function AlertFilterRail(props: AlertFilterRailProps) {
  const {
    search,
    onSearchChange,
    status,
    onStatusChange,
    severity,
    onSeverityChange,
    groupBy,
    onGroupByChange,
    sortDesc,
    onSortToggle,
  } = props

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-dash-border pb-3">
      <div className="relative max-w-xs flex-1">
        <Filter
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint size-4"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Filter by name, rule, message..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="form-input mono pl-8"
          style={{ height: 30, fontSize: 12 }}
        />
      </div>

      <PropChip
        icon={status ? Filter : PlusCircle}
        active={status !== null}
        onClick={() => {
          if (status === null) onStatusChange("firing")
          else if (status === "firing") onStatusChange("acknowledged")
          else onStatusChange(null)
        }}
      >
        {status ? `Status: ${status}` : "Status"}
      </PropChip>

      <PropChip
        icon={severity ? Filter : PlusCircle}
        active={severity !== null}
        onClick={() => {
          const order: (AlertSeverity | null)[] = [
            null,
            "critical",
            "warning",
            "info",
          ]
          const idx = order.indexOf(severity)
          onSeverityChange(order[(idx + 1) % order.length])
        }}
      >
        {severity ? `Severity: ${severity}` : "Severity"}
      </PropChip>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onSortToggle}
        >
          <ArrowUpDown />
          {sortDesc ? "Newest" : "Oldest"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            onGroupByChange(groupBy === "status" ? "severity" : "status")
          }
        >
          <Layers3 />
          Group: {groupBy}
        </button>
      </div>
    </div>
  )
}
