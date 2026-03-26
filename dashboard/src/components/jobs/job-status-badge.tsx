/**
 * @module job-status-badge
 *
 * Color-coded badge for Flink {@link JobStatus} values. Maps all 10 Flink
 * lifecycle states to semantic job-status color tokens (running, finished,
 * failed, cancelled, created). Transitional states like CANCELLING pulse
 * to indicate in-progress transitions.
 */
import { Badge } from "@flink-reactor/ui"
import type { JobStatus } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

/** Maps each {@link JobStatus} to Tailwind background/text classes using job color tokens. */
const statusStyles: Record<JobStatus, string> = {
  RUNNING: "bg-job-running/15 text-job-running",
  FINISHED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELED: "bg-job-cancelled/15 text-job-cancelled",
  CANCELLING: "bg-job-cancelled/15 text-job-cancelled animate-pulse",
  CREATED: "bg-job-created/15 text-job-created",
  FAILING: "bg-job-failed/15 text-job-failed",
  RESTARTING: "bg-job-running/15 text-job-running",
  SUSPENDED: "bg-job-created/15 text-job-created",
  RECONCILING: "bg-job-created/15 text-job-created",
}

/** Compact badge showing a Flink job lifecycle state with semantic coloring. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-[0.625rem] uppercase", statusStyles[status])}
    >
      {status}
    </Badge>
  )
}
