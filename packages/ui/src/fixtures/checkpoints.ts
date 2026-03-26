/**
 * Checkpoint-specific fixture factories — detail views and per-subtask stats.
 *
 * Core checkpoint factories live in `cluster.ts`; this file provides the
 * deeper checkpoint inspection types.
 */

import type { CheckpointDetail, CheckpointSubtaskStats } from "../types"

/** Create a completed checkpoint detail fixture with subtask acknowledgement data. */
export function createCheckpointDetail(overrides?: Partial<CheckpointDetail>): CheckpointDetail {
  return {
    id: 142,
    status: "COMPLETED",
    isSavepoint: false,
    triggerTimestamp: new Date(Date.now() - 60_000),
    latestAckTimestamp: new Date(Date.now() - 58_750),
    stateSize: 15_728_640,
    endToEndDuration: 1_250,
    numSubtasks: 8,
    numAcknowledgedSubtasks: 8,
    tasks: {},
    ...overrides,
  }
}

/** Create checkpoint subtask stats with sync/async duration and alignment data. */
export function createCheckpointSubtaskStats(overrides?: Partial<CheckpointSubtaskStats>): CheckpointSubtaskStats {
  return {
    subtaskIndex: 0,
    ackTimestamp: Date.now() - 58_750,
    endToEndDuration: 1_100,
    stateSize: 1_966_080,
    checkpointedSize: 1_966_080,
    syncDuration: 12,
    asyncDuration: 850,
    processedData: 262_144,
    alignmentDuration: 0,
    startDelay: 5,
    unalignedCheckpoint: false,
    ...overrides,
  }
}
