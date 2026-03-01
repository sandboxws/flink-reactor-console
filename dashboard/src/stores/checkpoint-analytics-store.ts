import { create } from "zustand";
import type { Checkpoint, FlinkJob } from "@/data/cluster-types";
import { fetchJobDetail as fetchJobDetailApi } from "@/lib/flink-api-client";
import { useClusterStore } from "./cluster-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = "stable" | "increasing" | "decreasing";

export type JobCheckpointSummary = {
  jobId: string;
  jobName: string;
  totalCheckpoints: number;
  successRate: number; // 0-100
  avgDuration: number; // ms
  lastDuration: number; // ms
  totalStateSize: number; // bytes
  lastStateSize: number; // bytes
  lastSuccessTime: Date | null;
  checkpointInterval: number; // ms (from config)
  durationTrend: TrendDirection;
  stateSizeTrend: TrendDirection;
  recentCheckpoints: Checkpoint[]; // last 20 for sparkline
};

export type CheckpointTimelineEntry = {
  timestamp: Date;
  successes: number;
  failures: number;
};

export type CheckpointAggregates = {
  totalCheckpoints: number;
  overallSuccessRate: number;
  avgDuration: number;
  totalStateSize: number;
};

// ---------------------------------------------------------------------------
// Trend computation — simple linear regression
// ---------------------------------------------------------------------------

export function computeTrend(values: number[]): TrendDirection {
  if (values.length < 3) return "stable";

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const mean = sumY / n;

  if (mean === 0) return "stable";

  const relativeSlope = slope / mean;

  if (relativeSlope > 0.05) return "increasing";
  if (relativeSlope < -0.05) return "decreasing";
  return "stable";
}

// ---------------------------------------------------------------------------
// Job checkpoint summary computation
// ---------------------------------------------------------------------------

function computeJobSummary(job: FlinkJob): JobCheckpointSummary | null {
  if (!job.checkpoints || job.checkpoints.length === 0) return null;

  const checkpoints = job.checkpoints;
  const completed = checkpoints.filter((c) => c.status === "COMPLETED");
  const failed = checkpoints.filter((c) => c.status === "FAILED");
  const totalCheckpoints = completed.length + failed.length;

  if (totalCheckpoints === 0) return null;

  const successRate =
    totalCheckpoints > 0 ? (completed.length / totalCheckpoints) * 100 : 0;

  // Duration: mean of last 10 completed checkpoints
  const recentCompleted = completed.slice(-10);
  const avgDuration =
    recentCompleted.length > 0
      ? recentCompleted.reduce((sum, c) => sum + c.duration, 0) /
        recentCompleted.length
      : 0;

  const lastCompleted = completed[completed.length - 1];
  const lastDuration = lastCompleted?.duration ?? 0;
  const totalStateSize = lastCompleted?.size ?? 0;
  const lastStateSize = lastCompleted?.size ?? 0;
  const lastSuccessTime = lastCompleted?.triggerTimestamp ?? null;

  const checkpointInterval = job.checkpointConfig?.interval ?? 0;

  // Trend computation: last 10 completed checkpoint durations and sizes
  const durationValues = recentCompleted.map((c) => c.duration);
  const sizeValues = recentCompleted.map((c) => c.size);

  const durationTrend = computeTrend(durationValues);
  const stateSizeTrend = computeTrend(sizeValues);

  // Last 20 checkpoints for sparkline (all statuses)
  const recentCheckpoints = checkpoints.slice(-20);

  return {
    jobId: job.id,
    jobName: job.name,
    totalCheckpoints,
    successRate,
    avgDuration,
    lastDuration,
    totalStateSize,
    lastStateSize,
    lastSuccessTime,
    checkpointInterval,
    durationTrend,
    stateSizeTrend,
    recentCheckpoints,
  };
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

function computeAggregates(
  summaries: JobCheckpointSummary[],
): CheckpointAggregates | null {
  if (summaries.length === 0) return null;

  const totalCheckpoints = summaries.reduce(
    (sum, s) => sum + s.totalCheckpoints,
    0,
  );

  // Weighted average success rate by checkpoint count
  const overallSuccessRate =
    totalCheckpoints > 0
      ? summaries.reduce(
          (sum, s) => sum + s.successRate * s.totalCheckpoints,
          0,
        ) / totalCheckpoints
      : 0;

  const avgDuration =
    summaries.reduce((sum, s) => sum + s.avgDuration, 0) / summaries.length;

  const totalStateSize = summaries.reduce(
    (sum, s) => sum + s.totalStateSize,
    0,
  );

  return { totalCheckpoints, overallSuccessRate, avgDuration, totalStateSize };
}

// ---------------------------------------------------------------------------
// Timeline bucketing — 1-minute buckets across all jobs
// ---------------------------------------------------------------------------

function computeTimeline(
  summaries: JobCheckpointSummary[],
): CheckpointTimelineEntry[] {
  const bucketMap = new Map<number, { successes: number; failures: number }>();

  for (const summary of summaries) {
    for (const cp of summary.recentCheckpoints) {
      if (cp.status === "IN_PROGRESS") continue;
      // Bucket to the nearest minute
      const bucketTime =
        Math.floor(cp.triggerTimestamp.getTime() / 60_000) * 60_000;
      const existing = bucketMap.get(bucketTime) ?? {
        successes: 0,
        failures: 0,
      };
      if (cp.status === "COMPLETED") existing.successes++;
      else if (cp.status === "FAILED") existing.failures++;
      bucketMap.set(bucketTime, existing);
    }
  }

  // Sort by timestamp, keep last 30 buckets
  const entries = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-30)
    .map(([ts, counts]) => ({
      timestamp: new Date(ts),
      successes: counts.successes,
      failures: counts.failures,
    }));

  return entries;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CheckpointAnalyticsState {
  summaries: JobCheckpointSummary[];
  timeline: CheckpointTimelineEntry[];
  aggregates: CheckpointAggregates | null;
  loading: boolean;
  lastUpdated: Date | null;

  initialize: () => void;
  startPolling: () => void;
  stopPolling: () => void;
}

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 2;

let checkpointInitialized = false;
let checkpointPollInterval: ReturnType<typeof setInterval> | null = null;
let unsubClusterStore: (() => void) | null = null;

// Staggered fetch state
let fetchQueue: string[] = [];
let fetchQueuePtr = 0;
const checkpointJobCache = new Map<string, FlinkJob>();

async function staggeredFetchCheckpointJobs() {
  const { runningJobs } = useClusterStore.getState();
  const runningIds = runningJobs.map((j) => j.id);

  // Evict stale entries
  const runningSet = new Set(runningIds);
  for (const cachedId of checkpointJobCache.keys()) {
    if (!runningSet.has(cachedId)) checkpointJobCache.delete(cachedId);
  }

  // Sync fetch queue
  fetchQueue = runningIds;
  if (fetchQueue.length === 0) return;

  if (fetchQueuePtr >= fetchQueue.length) fetchQueuePtr = 0;

  // Dequeue up to BATCH_SIZE jobs per tick
  const batch = fetchQueue.slice(fetchQueuePtr, fetchQueuePtr + BATCH_SIZE);
  fetchQueuePtr =
    (fetchQueuePtr + batch.length) % Math.max(1, fetchQueue.length);

  const results = await Promise.allSettled(
    batch.map((id) => fetchJobDetailApi(id)),
  );
  for (const result of results) {
    if (result.status === "fulfilled") {
      checkpointJobCache.set(result.value.id, result.value);
    }
  }
}

function recompute(set: (partial: Partial<CheckpointAnalyticsState>) => void) {
  const { runningJobs } = useClusterStore.getState();

  // Use cached detail jobs where available, fall back to overview data
  const enrichedJobs = runningJobs.map(
    (j) => checkpointJobCache.get(j.id) ?? j,
  );

  const summaries = enrichedJobs
    .map(computeJobSummary)
    .filter((s): s is JobCheckpointSummary => s !== null);

  const aggregates = computeAggregates(summaries);
  const timeline = computeTimeline(summaries);

  set({
    summaries,
    aggregates,
    timeline,
    loading: false,
    lastUpdated: new Date(),
  });
}

export const useCheckpointAnalyticsStore = create<CheckpointAnalyticsState>(
  (set) => ({
    summaries: [],
    timeline: [],
    aggregates: null,
    loading: true,
    lastUpdated: null,

    initialize: () => {
      if (checkpointInitialized) return;
      checkpointInitialized = true;

      // Subscribe to cluster-store for reactivity
      unsubClusterStore = useClusterStore.subscribe(() => {
        recompute(set);
      });

      // Compute initial snapshot
      recompute(set);

      // Kick off initial staggered fetch
      staggeredFetchCheckpointJobs().then(() => recompute(set));
    },

    startPolling: () => {
      if (checkpointPollInterval) return;

      checkpointPollInterval = setInterval(async () => {
        await staggeredFetchCheckpointJobs();
        recompute(set);
      }, POLL_INTERVAL_MS);
    },

    stopPolling: () => {
      if (checkpointPollInterval) {
        clearInterval(checkpointPollInterval);
        checkpointPollInterval = null;
      }
      if (unsubClusterStore) {
        unsubClusterStore();
        unsubClusterStore = null;
      }
      checkpointJobCache.clear();
      checkpointInitialized = false;
    },
  }),
);
