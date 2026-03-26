"use client"

/**
 * CheckpointsSection — Checkpoint history and configuration wrapper.
 *
 * Wraps the CheckpointsTab domain component with a section header
 * showing checkpoint counts. Provides no-op fetch callbacks since
 * templates don't connect to data sources.
 *
 * Accepts pure data props — no stores, no router.
 */

import { Database } from "lucide-react"
import type { FlinkJob } from "../../types"
import { CheckpointsTab } from "../../components/jobs/checkpoints-tab"

/** Renders the checkpoints section with checkpoint history, counts, and configuration. */
export function CheckpointsSection({ job }: { job: FlinkJob }) {
  const vertexNames: Record<string, string> = {}
  for (const v of job.plan?.vertices ?? []) {
    vertexNames[v.id] = v.name
  }

  // No-op fetchers — templates render with static data
  const noopFetchDetail = async () => null
  const noopFetchSubtaskDetail = async () => [] as never[]

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-400">
        <Database className="size-4" />
        <h3 className="text-sm font-medium text-zinc-200">Checkpoints</h3>
        {job.checkpointCounts && (
          <span className="text-xs text-zinc-500">
            {job.checkpointCounts.completed} completed &middot;{" "}
            {job.checkpointCounts.failed} failed
          </span>
        )}
      </div>

      {/* Tab content */}
      <CheckpointsTab
        jobId={job.id}
        checkpoints={job.checkpoints}
        counts={job.checkpointCounts}
        config={job.checkpointConfig}
        checkpointLatest={job.checkpointLatest}
        vertexNames={vertexNames}
        fetchCheckpointDetail={noopFetchDetail}
        fetchCheckpointSubtaskDetail={noopFetchSubtaskDetail}
      />
    </div>
  )
}
