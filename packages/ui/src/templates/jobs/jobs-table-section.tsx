"use client"

/**
 * JobsTableSection — Filterable jobs table with header and status controls.
 *
 * Wraps the JobsTable domain component in a page-level container with
 * a title, job count, and optional cancel action. Splits jobs into
 * running/completed views automatically based on the mode prop.
 *
 * Accepts pure data props — no stores, no router.
 */

import { Briefcase } from "lucide-react"
import { useState } from "react"
import type { FlinkJob } from "../../types"
import { JobsTable } from "../../components/jobs/jobs-table"

/** Renders the jobs table section with running/completed mode toggle and sortable job list. */
export function JobsTableSection({
  jobs,
  tappablePipelines,
  onJobClick,
  onCancelJob,
}: {
  jobs: FlinkJob[]
  tappablePipelines?: Set<string>
  onJobClick?: (jobId: string) => void
  onCancelJob?: (jobId: string) => void
}) {
  const [mode, setMode] = useState<"running" | "completed">("running")

  const runningStates = new Set([
    "RUNNING",
    "CREATED",
    "RESTARTING",
    "RECONCILING",
  ])

  const runningJobs = jobs.filter((j) => runningStates.has(j.status))
  const completedJobs = jobs.filter((j) => !runningStates.has(j.status))
  const activeJobs = mode === "running" ? runningJobs : completedJobs

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400">
          <Briefcase className="size-4" />
          <h2 className="text-sm font-medium text-zinc-200">Jobs</h2>
          <span className="text-xs tabular-nums text-zinc-500">
            {activeJobs.length}
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-dash-surface p-0.5">
          <button
            type="button"
            onClick={() => setMode("running")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === "running"
                ? "bg-dash-panel text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Running ({runningJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setMode("completed")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === "completed"
                ? "bg-dash-panel text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Completed ({completedJobs.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <JobsTable
          mode={mode}
          jobs={activeJobs}
          tappablePipelines={tappablePipelines}
          onJobClick={onJobClick}
          onCancelJob={onCancelJob}
        />
      </div>
    </div>
  )
}
