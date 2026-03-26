/** Job lifecycle status badge -- color-coded pill for RUNNING/FINISHED/CANCELED/FAILED states. */
"use client"

import { Badge } from "../components/ui/badge"
import type { JobStatus } from "../types"
import { cn } from "../lib/cn"

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

/** Color-coded pill displaying a Flink job's lifecycle state (RUNNING, FINISHED, CANCELED, FAILED, etc.). */
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
