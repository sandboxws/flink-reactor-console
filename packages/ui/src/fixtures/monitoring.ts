/** Fixture data for checkpoint monitoring — summaries, timelines, and cross-job aggregates. */

import type { JobCheckpointSummary, CheckpointTimelineEntry, CheckpointAggregates } from "../types"
import { createCheckpoint } from "./cluster"

/** Create a job checkpoint summary with 142 checkpoints and 20 recent entries. */
export function createJobCheckpointSummary(overrides?: Partial<JobCheckpointSummary>): JobCheckpointSummary {
  return {
    jobId: "job-001",
    jobName: "ecommerce-order-enrichment",
    totalCheckpoints: 142,
    successRate: 100,
    avgDuration: 1_200,
    lastDuration: 1_250,
    totalStateSize: 2_231_369_728,
    lastStateSize: 15_728_640,
    lastSuccessTime: new Date(Date.now() - 60_000),
    checkpointInterval: 60_000,
    durationTrend: "stable",
    stateSizeTrend: "increasing",
    recentCheckpoints: Array.from({ length: 20 }, (_, i) =>
      createCheckpoint({ id: 123 + i, triggerTimestamp: new Date(Date.now() - (20 - i) * 60_000) }),
    ),
    ...overrides,
  }
}

/** Create a single checkpoint timeline entry with 10 successes and zero failures. */
export function createCheckpointTimelineEntry(overrides?: Partial<CheckpointTimelineEntry>): CheckpointTimelineEntry {
  return {
    timestamp: new Date(),
    successes: 10,
    failures: 0,
    ...overrides,
  }
}

/** Create cross-job checkpoint aggregates with 99.3% overall success rate. */
export function createCheckpointAggregates(overrides?: Partial<CheckpointAggregates>): CheckpointAggregates {
  return {
    totalCheckpoints: 284,
    overallSuccessRate: 99.3,
    avgDuration: 1_150,
    totalStateSize: 4_462_739_456,
    ...overrides,
  }
}
