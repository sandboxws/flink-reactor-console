// Checkpoint factories are in cluster.ts since Checkpoint type is a core cluster type.
// This file provides additional checkpoint-specific factories.

import type { CheckpointDetail, CheckpointSubtaskStats } from "../types"

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
