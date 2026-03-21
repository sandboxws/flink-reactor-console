"use client"

import { formatDistanceToNow } from "date-fns"
import { Server } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { MemoryBar } from "../../shared/memory-bar"
import { EmptyState } from "../../shared/empty-state"
import type { TaskManager } from "../../types"
import { cn } from "../../lib/cn"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TmListSectionProps {
  taskManagers: TaskManager[]
  onSelect?: (tmId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cpuColor(usage: number): string {
  if (usage > 0.85) return "text-job-failed"
  if (usage >= 0.6) return "text-fr-amber"
  return "text-job-running"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TmListSection({
  taskManagers,
  onSelect,
}: TmListSectionProps) {
  if (taskManagers.length === 0) {
    return (
      <EmptyState icon={Server} message="No task managers registered." />
    )
  }

  return (
    <section className="p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-semibold text-zinc-100">
          Task Managers
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {taskManagers.length} TM{taskManagers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-dash-border hover:bg-transparent">
              <TableHead className="text-[10px]">ID</TableHead>
              <TableHead className="text-center text-[10px]">Slots</TableHead>
              <TableHead className="text-[10px]">Memory</TableHead>
              <TableHead className="text-right text-[10px]">CPU</TableHead>
              <TableHead className="text-right text-[10px]">Heartbeat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskManagers.map((tm) => {
              const cpuPct = Math.round(tm.metrics.cpuUsage * 100)
              return (
                <TableRow
                  key={tm.id}
                  className={cn(
                    "border-dash-border",
                    onSelect && "cursor-pointer",
                  )}
                  onClick={() => onSelect?.(tm.id)}
                >
                  <TableCell className="max-w-[200px] truncate font-mono text-xs text-zinc-200">
                    {tm.id}
                  </TableCell>
                  <TableCell className="text-center text-xs text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      {tm.slotsTotal - tm.slotsFree}
                    </span>
                    /{tm.slotsTotal}
                  </TableCell>
                  <TableCell>
                    <MemoryBar
                      used={tm.metrics.heapUsed}
                      total={tm.metrics.heapMax}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        cpuColor(tm.metrics.cpuUsage),
                      )}
                    >
                      {cpuPct}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-zinc-500">
                    {formatDistanceToNow(tm.lastHeartbeat, {
                      addSuffix: true,
                    })}
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
