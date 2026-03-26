"use client"

/**
 * CheckpointsSection demo — renders checkpoint history
 * with a fixture job containing sample checkpoints.
 */

import { CheckpointsSection } from "./checkpoints-section"
import { createFlinkJob, createCheckpoint, createCheckpointCounts } from "../../fixtures"

/** Standalone demo of the checkpoints section with fixture checkpoint data. */
export function CheckpointsSectionDemo() {
  const job = createFlinkJob({
    checkpoints: [
      createCheckpoint({ id: 142, duration: 1_100, status: "COMPLETED" }),
      createCheckpoint({ id: 141, duration: 1_250, status: "COMPLETED" }),
      createCheckpoint({ id: 140, duration: 980, status: "COMPLETED" }),
      createCheckpoint({ id: 139, duration: 2_100, status: "FAILED" }),
    ],
    checkpointCounts: createCheckpointCounts({
      completed: 141,
      failed: 1,
      total: 142,
    }),
  })

  return <CheckpointsSection job={job} />
}
