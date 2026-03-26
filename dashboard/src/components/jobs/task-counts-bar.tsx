/**
 * @module task-counts-bar
 *
 * Proportional progress bar visualizing task status distribution across a job's
 * parallelism slots. Each segment (pending, running, finished, canceling, failed)
 * is colored with the corresponding job-status token. A tooltip overlay shows
 * per-status counts on hover.
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@flink-reactor/ui"
import type { TaskCounts, TaskStatus } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

/** Ordered segment definitions mapping each {@link TaskStatus} to its display label and color class. */
const segments: { key: TaskStatus; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "bg-job-created" },
  { key: "running", label: "Running", color: "bg-job-running" },
  { key: "finished", label: "Finished", color: "bg-job-finished" },
  { key: "canceling", label: "Canceling", color: "bg-job-cancelled" },
  { key: "failed", label: "Failed", color: "bg-job-failed" },
]

/**
 * Stacked progress bar showing the distribution of task statuses for a job.
 * Segment widths are proportional to count. Hover tooltip lists non-zero statuses
 * with their exact counts.
 */
export function TaskCountsBar({ tasks }: { tasks: TaskCounts }) {
  const total = Object.values(tasks).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="flex h-2 w-24 overflow-hidden rounded-full bg-white/5">
              {segments.map(
                (seg) =>
                  tasks[seg.key] > 0 && (
                    <div
                      key={seg.key}
                      className={cn("h-full", seg.color)}
                      style={{
                        width: `${(tasks[seg.key] / total) * 100}%`,
                      }}
                    />
                  ),
              )}
            </div>
            <span className="text-xs tabular-nums text-zinc-500">{total}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {segments.map(
              (seg) =>
                tasks[seg.key] > 0 && (
                  <div
                    key={seg.key}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className={cn("size-2 rounded-full", seg.color)} />
                    <span className="text-zinc-400">{seg.label}</span>
                    <span className="ml-auto tabular-nums font-medium text-zinc-200">
                      {tasks[seg.key]}
                    </span>
                  </div>
                ),
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
