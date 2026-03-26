import { create } from "zustand"
import type { Checkpoint, FlinkJob } from "@flink-reactor/ui"
import { fetchJobDetail as fetchJobDetailApi } from "@/lib/graphql-api-client"
import { useClusterStore } from "./cluster-store"

/**
 * Checkpoint analytics store — aggregates checkpoint metrics across all running
 * jobs for the checkpoint analytics dashboard.
 *
 * Uses staggered polling (2 jobs per 30s tick) to avoid overwhelming the Flink
 * REST API. Subscribes to cluster-store for reactivity — when running jobs
 * first appear, an immediate fetch is triggered so data appears within seconds.
 *
 * @module checkpoint-analytics-store
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of a metric trend computed via simple linear regression. */
export type TrendDirection = "stable" | "increasing" | "decreasing"

/** Per-job checkpoint summary with trend analysis and sparkline data. */
export type JobCheckpointSummary = {
  jobId: string
  jobName: string
  /** Total completed + failed checkpoints (uses Flink lifetime counts when available). */
  totalCheckpoints: number
  /** Success rate as a percentage (0–100). */
  successRate: number
  /** Mean duration of the last 10 completed checkpoints in ms. */
  avgDuration: number
  /** Duration of the most recent completed checkpoint in ms. */
  lastDuration: number
  /** State size of the most recent completed checkpoint in bytes. */
  totalStateSize: number
  /** State size of the most recent completed checkpoint in bytes. */
  lastStateSize: number
  /** Timestamp of the most recent successful checkpoint, or null if none. */
  lastSuccessTime: Date | null
  /** Configured checkpoint interval in ms (from Flink checkpoint config). */
  checkpointInterval: number
  /** Trend direction for checkpoint duration over recent history. */
  durationTrend: TrendDirection
  /** Trend direction for state size over recent history. */
  stateSizeTrend: TrendDirection
  /** Last 20 checkpoints (all statuses) for sparkline rendering. */
  recentCheckpoints: Checkpoint[]
}

/** A single 1-minute bucket in the checkpoint success/failure timeline. */
export type CheckpointTimelineEntry = {
  timestamp: Date
  successes: number
  failures: number
}

/** Cluster-wide checkpoint aggregates across all running jobs. */
export type CheckpointAggregates = {
  /** Total checkpoints across all jobs. */
  totalCheckpoints: number
  /** Weighted average success rate by checkpoint count. */
  overallSuccessRate: number
  /** Mean of per-job average durations. */
  avgDuration: number
  /** Sum of latest state sizes across all jobs. */
  totalStateSize: number
}

/**
 * Flink uses Long.MAX_VALUE (~9.2e18 ms) as interval when checkpointing is
 * disabled.  Anything above ~31 years is effectively "not configured".
 */
const CHECKPOINT_DISABLED_INTERVAL = 1_000_000_000_000

// ---------------------------------------------------------------------------
// Trend computation — simple linear regression
// ---------------------------------------------------------------------------

/**
 * Compute the trend direction of a numeric series via simple linear regression.
 * Returns "stable" for series shorter than 3 values or where the relative
 * slope is within +/- 5% of the mean.
 */
export function computeTrend(values: number[]): TrendDirection {
  if (values.length < 3) return "stable"

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const mean = sumY / n

  if (mean === 0) return "stable"

  const relativeSlope = slope / mean

  if (relativeSlope > 0.05) return "increasing"
  if (relativeSlope < -0.05) return "decreasing"
  return "stable"
}

// ---------------------------------------------------------------------------
// Job checkpoint summary computation
// ---------------------------------------------------------------------------

/** Compute a checkpoint summary for a single job, or null if no checkpoints exist. */
function computeJobSummary(job: FlinkJob): JobCheckpointSummary | null {
  if (!job.checkpoints || job.checkpoints.length === 0) return null

  const checkpoints = job.checkpoints
  const completed = checkpoints.filter((c) => c.status === "COMPLETED")

  // Use Flink's lifetime counts when available (history[] is limited by
  // state.checkpoints.num-retained, typically 10). Fall back to history length
  // when counts aren't available (e.g. overview-only data).
  const counts = job.checkpointCounts
  const totalCheckpoints = counts
    ? counts.completed + counts.failed
    : completed.length + checkpoints.filter((c) => c.status === "FAILED").length

  if (totalCheckpoints === 0) return null

  const completedCount = counts ? counts.completed : completed.length
  const successRate =
    totalCheckpoints > 0 ? (completedCount / totalCheckpoints) * 100 : 0

  // Duration: mean of last 10 completed checkpoints
  const recentCompleted = completed.slice(-10)
  const avgDuration =
    recentCompleted.length > 0
      ? recentCompleted.reduce((sum, c) => sum + c.duration, 0) /
        recentCompleted.length
      : 0

  const lastCompleted = completed[completed.length - 1]
  const lastDuration = lastCompleted?.duration ?? 0
  const totalStateSize = lastCompleted?.size ?? 0
  const lastStateSize = lastCompleted?.size ?? 0
  const lastSuccessTime = lastCompleted?.triggerTimestamp ?? null

  const checkpointInterval = job.checkpointConfig?.interval ?? 0

  // Trend computation: last 10 completed checkpoint durations and sizes
  const durationValues = recentCompleted.map((c) => c.duration)
  const sizeValues = recentCompleted.map((c) => c.size)

  const durationTrend = computeTrend(durationValues)
  const stateSizeTrend = computeTrend(sizeValues)

  // Last 20 checkpoints for sparkline (all statuses)
  const recentCheckpoints = checkpoints.slice(-20)

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
  }
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

/** Compute cluster-wide aggregates from per-job summaries. */
function computeAggregates(
  summaries: JobCheckpointSummary[],
): CheckpointAggregates | null {
  if (summaries.length === 0) return null

  const totalCheckpoints = summaries.reduce(
    (sum, s) => sum + s.totalCheckpoints,
    0,
  )

  // Weighted average success rate by checkpoint count
  const overallSuccessRate =
    totalCheckpoints > 0
      ? summaries.reduce(
          (sum, s) => sum + s.successRate * s.totalCheckpoints,
          0,
        ) / totalCheckpoints
      : 0

  const avgDuration =
    summaries.reduce((sum, s) => sum + s.avgDuration, 0) / summaries.length

  const totalStateSize = summaries.reduce((sum, s) => sum + s.totalStateSize, 0)

  return { totalCheckpoints, overallSuccessRate, avgDuration, totalStateSize }
}

// ---------------------------------------------------------------------------
// Timeline bucketing — 1-minute buckets across all jobs
// ---------------------------------------------------------------------------

/** Bucket checkpoints into 1-minute time slots for the timeline chart (last 30 buckets). */
function computeTimeline(
  summaries: JobCheckpointSummary[],
): CheckpointTimelineEntry[] {
  const bucketMap = new Map<number, { successes: number; failures: number }>()

  for (const summary of summaries) {
    for (const cp of summary.recentCheckpoints) {
      if (cp.status === "IN_PROGRESS") continue
      // Bucket to the nearest minute
      const bucketTime =
        Math.floor(cp.triggerTimestamp.getTime() / 60_000) * 60_000
      const existing = bucketMap.get(bucketTime) ?? {
        successes: 0,
        failures: 0,
      }
      if (cp.status === "COMPLETED") existing.successes++
      else if (cp.status === "FAILED") existing.failures++
      bucketMap.set(bucketTime, existing)
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
    }))

  return entries
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CheckpointAnalyticsState {
  /** Per-job checkpoint summaries for all running jobs. */
  summaries: JobCheckpointSummary[]
  /** 1-minute bucketed success/failure timeline for the chart. */
  timeline: CheckpointTimelineEntry[]
  /** Cluster-wide checkpoint aggregates, or null if no data. */
  aggregates: CheckpointAggregates | null
  /** True while the initial detail fetch is in progress (shows skeleton). */
  loading: boolean
  /** Timestamp of the last successful recomputation. */
  lastUpdated: Date | null
  /** True when at least one running job has a real checkpoint interval configured. */
  checkpointsConfigured: boolean

  /** Subscribe to cluster-store and trigger an initial fetch (guarded — runs once). */
  initialize: () => void
  /** Start the 30s staggered polling interval for checkpoint detail fetches. */
  startPolling: () => void
  /** Stop polling, unsubscribe from cluster-store, and clear the job cache. */
  stopPolling: () => void
}

const POLL_INTERVAL_MS = 30_000
const BATCH_SIZE = 2

let checkpointInitialized = false
let checkpointPollInterval: ReturnType<typeof setInterval> | null = null
let unsubClusterStore: (() => void) | null = null

// Staggered fetch state
let fetchQueue: string[] = []
let fetchQueuePtr = 0
const checkpointJobCache = new Map<string, FlinkJob>()
let initialFetchTriggered = false

/** Fetch detail for up to BATCH_SIZE running jobs per tick and cache the results. */
async function staggeredFetchCheckpointJobs() {
  const { runningJobs } = useClusterStore.getState()
  const runningIds = runningJobs.map((j) => j.id)

  // Evict stale entries
  const runningSet = new Set(runningIds)
  for (const cachedId of checkpointJobCache.keys()) {
    if (!runningSet.has(cachedId)) checkpointJobCache.delete(cachedId)
  }

  // Sync fetch queue
  fetchQueue = runningIds
  if (fetchQueue.length === 0) return

  if (fetchQueuePtr >= fetchQueue.length) fetchQueuePtr = 0

  // Dequeue up to BATCH_SIZE jobs per tick
  const batch = fetchQueue.slice(fetchQueuePtr, fetchQueuePtr + BATCH_SIZE)
  fetchQueuePtr =
    (fetchQueuePtr + batch.length) % Math.max(1, fetchQueue.length)

  const results = await Promise.allSettled(
    batch.map((id) => fetchJobDetailApi(id)),
  )
  for (const result of results) {
    if (result.status === "fulfilled") {
      checkpointJobCache.set(result.value.id, result.value)
    }
  }
}

/** Recompute summaries, aggregates, and timeline from cached job data. */
function recompute(set: (partial: Partial<CheckpointAnalyticsState>) => void) {
  const { runningJobs } = useClusterStore.getState()

  // Use cached detail jobs where available, fall back to overview data
  const enrichedJobs = runningJobs.map((j) => checkpointJobCache.get(j.id) ?? j)

  const summaries = enrichedJobs
    .map(computeJobSummary)
    .filter((s): s is JobCheckpointSummary => s !== null)

  const aggregates = computeAggregates(summaries)
  const timeline = computeTimeline(summaries)

  // Keep loading=true when running jobs exist but no detail data has been
  // fetched yet — this shows the skeleton instead of empty charts.
  const cacheIsWarm = runningJobs.some((j) => checkpointJobCache.has(j.id))
  const loading = runningJobs.length > 0 && !cacheIsWarm

  // Check if any cached job has a real checkpoint interval configured.
  // Flink sets interval to Long.MAX_VALUE when checkpointing is disabled.
  const checkpointsConfigured = enrichedJobs.some(
    (j) =>
      j.checkpointConfig != null &&
      j.checkpointConfig.interval < CHECKPOINT_DISABLED_INTERVAL,
  )

  set({
    summaries,
    aggregates,
    timeline,
    loading,
    checkpointsConfigured,
    lastUpdated: loading ? null : new Date(),
  })
}

export const useCheckpointAnalyticsStore = create<CheckpointAnalyticsState>(
  (set) => ({
    summaries: [],
    timeline: [],
    aggregates: null,
    loading: true,
    lastUpdated: null,
    checkpointsConfigured: true, // assume configured until proven otherwise

    initialize: () => {
      if (checkpointInitialized) return
      checkpointInitialized = true

      // Subscribe to cluster-store for reactivity.
      // When running jobs first appear but the cache is cold, trigger an
      // immediate staggered fetch so data appears within seconds rather
      // than waiting for the 30-second poll interval.
      unsubClusterStore = useClusterStore.subscribe(() => {
        const { runningJobs } = useClusterStore.getState()
        if (
          !initialFetchTriggered &&
          runningJobs.length > 0 &&
          !runningJobs.some((j) => checkpointJobCache.has(j.id))
        ) {
          initialFetchTriggered = true
          staggeredFetchCheckpointJobs().then(() => recompute(set))
        }
        recompute(set)
      })

      // Compute initial snapshot
      recompute(set)

      // Kick off initial staggered fetch (no-op if runningJobs is empty yet)
      staggeredFetchCheckpointJobs().then(() => recompute(set))
    },

    startPolling: () => {
      if (checkpointPollInterval) return

      checkpointPollInterval = setInterval(async () => {
        await staggeredFetchCheckpointJobs()
        recompute(set)
      }, POLL_INTERVAL_MS)
    },

    stopPolling: () => {
      if (checkpointPollInterval) {
        clearInterval(checkpointPollInterval)
        checkpointPollInterval = null
      }
      if (unsubClusterStore) {
        unsubClusterStore()
        unsubClusterStore = null
      }
      checkpointJobCache.clear()
      checkpointInitialized = false
      initialFetchTriggered = false
    },
  }),
)
