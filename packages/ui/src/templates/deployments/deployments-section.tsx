"use client"

import { formatDistanceToNow } from "date-fns"
import { GitBranch } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { EmptyState } from "../../shared/empty-state"
import type { BlueGreenDeployment, BlueGreenState, StateBadgeColor } from "../../types"
import { cn } from "../../lib/cn"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeploymentsSectionProps {
  deployments: BlueGreenDeployment[]
  onSelect?: (name: string) => void
}

// ---------------------------------------------------------------------------
// State badge
// ---------------------------------------------------------------------------

function stateColor(state: BlueGreenState): StateBadgeColor {
  if (state.startsWith("ACTIVE")) return "green"
  if (state.startsWith("TRANSITIONING") || state.startsWith("SAVEPOINTING"))
    return "amber"
  if (state === "INITIALIZING_BLUE") return "blue"
  return "gray"
}

const COLOR_CLASSES: Record<StateBadgeColor, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  gray: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Renders the deployments section with blue-green deployment list and state badges. */
export function DeploymentsSection({
  deployments,
  onSelect,
}: DeploymentsSectionProps) {
  if (deployments.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        message="No blue-green deployments found."
      />
    )
  }

  return (
    <section className="p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-semibold text-zinc-100">
          Blue-Green Deployments
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {deployments.length} deployment{deployments.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-dash-border hover:bg-transparent">
              <TableHead className="text-[10px]">Name</TableHead>
              <TableHead className="text-[10px]">Namespace</TableHead>
              <TableHead className="text-[10px]">State</TableHead>
              <TableHead className="text-[10px]">Active Job</TableHead>
              <TableHead className="text-right text-[10px]">Last Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => {
              const badgeColor = stateColor(d.state)
              return (
                <TableRow
                  key={`${d.namespace}/${d.name}`}
                  className={cn(
                    "border-dash-border",
                    onSelect && "cursor-pointer",
                  )}
                  onClick={() => onSelect?.(d.name)}
                >
                  <TableCell className="text-xs font-medium text-zinc-200">
                    {d.name}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {d.namespace}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        COLOR_CLASSES[badgeColor],
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          badgeColor === "green" && "bg-emerald-400",
                          badgeColor === "amber" && "bg-amber-400",
                          badgeColor === "blue" && "bg-sky-400",
                          badgeColor === "gray" && "bg-zinc-400",
                        )}
                      />
                      {d.state.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate font-mono text-xs text-zinc-400">
                    {d.activeJobId ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-zinc-500">
                    {d.lastReconciledTimestamp
                      ? formatDistanceToNow(new Date(d.lastReconciledTimestamp), {
                          addSuffix: true,
                        })
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
