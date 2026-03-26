import { create } from "zustand"
import {
  analyzeJob,
  type BottleneckScore,
  type Recommendation,
} from "@/data/bottleneck-analyzer"
import type {
  ClusterOverview,
  FlinkJob,
  TaskManager,
} from "@flink-reactor/ui"
import { fetchJobDetail as fetchJobDetailApi } from "@/lib/graphql-api-client"
import { useClusterStore } from "./cluster-store"
import { useConfigStore } from "./config-store"

/**
 * Insights store — cluster health scoring, issue detection, and bottleneck analysis.
 *
 * Computes a composite health score from five weighted sub-scores (slot utilization,
 * backpressure, checkpoint health, memory pressure, exception rate). Subscribes to
 * cluster-store for real-time reactivity and uses staggered job detail fetching
 * to populate vertex-level data for bottleneck analysis.
 *
 * Health history is kept in a ring buffer (last 60 snapshots) for trend visualization.
 *
 * @module insights-store
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single health dimension with score, weight, and status classification. */
export type HealthSubScore = {
  /** Human-readable dimension name (e.g. "Slot Utilization"). */
  name: string
  /** Score from 0 (critical) to 100 (healthy). */
  score: number
  /** Weight in the composite score (all weights sum to 1.0). */
  weight: number
  /** Status classification derived from score thresholds. */
  status: "healthy" | "warning" | "critical"
  /** Human-readable detail string explaining the score. */
  detail: string
}

/** A detected health issue with severity and source attribution. */
export type HealthIssue = {
  /** Unique issue identifier. */
  id: string
  /** Issue severity. */
  severity: "critical" | "warning" | "info"
  /** Human-readable issue description. */
  message: string
  /** Issue source category (e.g. "memory", "backpressure", "checkpoint"). */
  source: string
  /** When this issue was detected. */
  timestamp: Date
}

/** A point-in-time health assessment with composite score and breakdowns. */
export type HealthSnapshot = {
  /** When this snapshot was computed. */
  timestamp: Date
  /** Composite weighted health score (0–100). */
  score: number
  /** Individual sub-score breakdowns. */
  subScores: HealthSubScore[]
}

// ---------------------------------------------------------------------------
// Ring buffer — O(1) push, no reallocation
// ---------------------------------------------------------------------------

/** Fixed-capacity ring buffer with O(1) push and no reallocation. */
class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private writePtr = 0
  private count = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.writePtr] = item
    this.writePtr = (this.writePtr + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  toArray(): T[] {
    if (this.count === 0) return []
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count) as T[]
    }
    // Full buffer: oldest is at writePtr, newest is at writePtr - 1
    return [
      ...this.buffer.slice(this.writePtr),
      ...this.buffer.slice(0, this.writePtr),
    ] as T[]
  }
}

// ---------------------------------------------------------------------------
// Sub-score weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  slotUtilization: 0.3,
  backpressure: 0.25,
  checkpointHealth: 0.2,
  memoryPressure: 0.15,
  exceptionRate: 0.1,
} as const

// ---------------------------------------------------------------------------
// Score → status helper
// ---------------------------------------------------------------------------

/** Map a numeric score to a status classification: >=80 healthy, >=50 warning, else critical. */
function scoreToStatus(score: number): "healthy" | "warning" | "critical" {
  if (score >= 80) return "healthy"
  if (score >= 50) return "warning"
  return "critical"
}

// ---------------------------------------------------------------------------
// Sub-score computation functions
// ---------------------------------------------------------------------------

/** Compute the slot utilization sub-score based on available vs total task slots. */
export function computeSlotUtilizationScore(
  overview: ClusterOverview | null,
): HealthSubScore {
  if (!overview || overview.totalTaskSlots === 0) {
    return {
      name: "Slot Utilization",
      score: 50,
      weight: WEIGHTS.slotUtilization,
      status: "warning",
      detail: "No task managers registered",
    }
  }

  const score = Math.round(
    (overview.availableTaskSlots / overview.totalTaskSlots) * 100,
  )
  const usedPct = 100 - score
  return {
    name: "Slot Utilization",
    score,
    weight: WEIGHTS.slotUtilization,
    status: scoreToStatus(score),
    detail: `${overview.availableTaskSlots}/${overview.totalTaskSlots} slots available (${usedPct}% used)`,
  }
}

/** Compute the backpressure sub-score by averaging vertex backpressure levels across running jobs. */
export function computeBackpressureScore(jobs: FlinkJob[]): HealthSubScore {
  const runningJobs = jobs.filter((j) => j.status === "RUNNING")
  if (runningJobs.length === 0) {
    return {
      name: "Backpressure",
      score: 100,
      weight: WEIGHTS.backpressure,
      status: "healthy",
      detail: "No running jobs",
    }
  }

  const levels: number[] = []
  for (const job of runningJobs) {
    if (!job.backpressure) continue
    for (const bp of Object.values(job.backpressure)) {
      const mapped = bp.level === "ok" ? 100 : bp.level === "low" ? 50 : 0
      levels.push(mapped)
    }
  }

  if (levels.length === 0) {
    return {
      name: "Backpressure",
      score: 100,
      weight: WEIGHTS.backpressure,
      status: "healthy",
      detail: "No backpressure data available",
    }
  }

  const score = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
  const highCount = levels.filter((l) => l === 0).length
  const detail =
    highCount > 0
      ? `${highCount} vertex(es) with high backpressure`
      : "No backpressure detected"

  return {
    name: "Backpressure",
    score,
    weight: WEIGHTS.backpressure,
    status: scoreToStatus(score),
    detail,
  }
}

/** Compute the checkpoint health sub-score from the success rate of recent checkpoints. */
export function computeCheckpointHealthScore(jobs: FlinkJob[]): HealthSubScore {
  const runningJobs = jobs.filter((j) => j.status === "RUNNING")
  if (runningJobs.length === 0) {
    return {
      name: "Checkpoint Health",
      score: 100,
      weight: WEIGHTS.checkpointHealth,
      status: "healthy",
      detail: "No running jobs",
    }
  }

  const rates: number[] = []
  for (const job of runningJobs) {
    if (!job.checkpoints || job.checkpoints.length === 0) continue
    const recent = job.checkpoints.slice(-10)
    const completed = recent.filter((c) => c.status === "COMPLETED").length
    rates.push((completed / recent.length) * 100)
  }

  if (rates.length === 0) {
    return {
      name: "Checkpoint Health",
      score: 100,
      weight: WEIGHTS.checkpointHealth,
      status: "healthy",
      detail: "No checkpoint data available",
    }
  }

  const score = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
  const detail =
    score >= 90
      ? "All checkpoints succeeding"
      : `${score}% checkpoint success rate`

  return {
    name: "Checkpoint Health",
    score,
    weight: WEIGHTS.checkpointHealth,
    status: scoreToStatus(score),
    detail,
  }
}

/** Compute the memory pressure sub-score from the worst-case TM heap utilization. */
export function computeMemoryPressureScore(
  taskManagers: TaskManager[],
): HealthSubScore {
  if (taskManagers.length === 0) {
    return {
      name: "Memory Pressure",
      score: 100,
      weight: WEIGHTS.memoryPressure,
      status: "healthy",
      detail: "No task managers registered",
    }
  }

  const ratios = taskManagers.map((tm) => {
    if (!tm.metrics || tm.metrics.heapMax === 0) return 100
    return Math.round((1 - tm.metrics.heapUsed / tm.metrics.heapMax) * 100)
  })

  // Worst case across all TMs
  const score = Math.min(...ratios)
  const worstTm = taskManagers[ratios.indexOf(score)]
  const usedPct = 100 - score
  const detail =
    score >= 80
      ? `All TMs below 20% heap usage`
      : `Worst: ${worstTm?.id?.slice(0, 8) ?? "unknown"} at ${usedPct}% heap`

  return {
    name: "Memory Pressure",
    score,
    weight: WEIGHTS.memoryPressure,
    status: scoreToStatus(score),
    detail,
  }
}

/** Compute the exception rate sub-score by counting exceptions in the last 5 minutes. */
export function computeExceptionRateScore(jobs: FlinkJob[]): HealthSubScore {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000
  let totalExceptions = 0

  for (const job of jobs) {
    if (!job.exceptions) continue
    totalExceptions += job.exceptions.filter(
      (e) => e.timestamp.getTime() > fiveMinAgo,
    ).length
  }

  const score = Math.max(0, 100 - totalExceptions * 20)
  const detail =
    totalExceptions === 0
      ? "No recent exceptions"
      : `${totalExceptions} exception(s) in the last 5 minutes`

  return {
    name: "Exception Rate",
    score,
    weight: WEIGHTS.exceptionRate,
    status: scoreToStatus(score),
    detail,
  }
}

// ---------------------------------------------------------------------------
// Composite health snapshot
// ---------------------------------------------------------------------------

/** Compute a full health snapshot with composite score from all five sub-scores. */
export function computeHealthSnapshot(
  overview: ClusterOverview | null,
  jobs: FlinkJob[],
  taskManagers: TaskManager[],
): HealthSnapshot {
  const subScores = [
    computeSlotUtilizationScore(overview),
    computeBackpressureScore(jobs),
    computeCheckpointHealthScore(jobs),
    computeMemoryPressureScore(taskManagers),
    computeExceptionRateScore(jobs),
  ]

  const compositeScore = Math.round(
    subScores.reduce((sum, s) => sum + s.score * s.weight, 0),
  )

  return {
    timestamp: new Date(),
    score: compositeScore,
    subScores,
  }
}

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

/** Detect active health issues (memory pressure, backpressure, checkpoint failures, low slots). */
export function detectIssues(
  overview: ClusterOverview | null,
  jobs: FlinkJob[],
  taskManagers: TaskManager[],
): HealthIssue[] {
  const issues: HealthIssue[] = []
  const now = new Date()

  // Memory pressure: TM heap > 85%
  for (const tm of taskManagers) {
    if (!tm.metrics || tm.metrics.heapMax === 0) continue
    const usedPct = Math.round((tm.metrics.heapUsed / tm.metrics.heapMax) * 100)
    if (usedPct > 85) {
      issues.push({
        id: `mem-${tm.id}`,
        severity: usedPct > 95 ? "critical" : "warning",
        message: `TM ${tm.id.slice(0, 8)} heap at ${usedPct}%`,
        source: "memory",
        timestamp: now,
      })
    }
  }

  // Backpressure: vertex with high backpressure
  for (const job of jobs) {
    if (job.status !== "RUNNING" || !job.backpressure || !job.plan) continue
    for (const [vertexId, bp] of Object.entries(job.backpressure)) {
      if (bp.level === "high") {
        const vertex = job.plan.vertices.find((v) => v.id === vertexId)
        const vertexName = vertex?.name ?? vertexId.slice(0, 8)
        issues.push({
          id: `bp-${job.id}-${vertexId}`,
          severity: "warning",
          message: `High backpressure on ${vertexName} in ${job.name}`,
          source: "backpressure",
          timestamp: now,
        })
      }
    }
  }

  // Checkpoint failures
  for (const job of jobs) {
    if (job.status !== "RUNNING" || !job.checkpoints) continue
    const recent = job.checkpoints.slice(-5)
    const failures = recent.filter((c) => c.status === "FAILED").length
    if (failures >= 2) {
      issues.push({
        id: `ckpt-${job.id}`,
        severity: failures >= 4 ? "critical" : "warning",
        message: `${failures} of last 5 checkpoints failed in ${job.name}`,
        source: "checkpoint",
        timestamp: now,
      })
    }
  }

  // Low slot availability (< 20%)
  if (overview && overview.totalTaskSlots > 0) {
    const availPct = Math.round(
      (overview.availableTaskSlots / overview.totalTaskSlots) * 100,
    )
    if (availPct < 20) {
      issues.push({
        id: "slots-low",
        severity: availPct < 5 ? "critical" : "warning",
        message: `Only ${availPct}% task slots available (${overview.availableTaskSlots}/${overview.totalTaskSlots})`,
        source: "slots",
        timestamp: now,
      })
    }
  }

  // Sort by severity: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return issues
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface InsightsState {
  /** Most recent health snapshot, or null before first computation. */
  currentHealth: HealthSnapshot | null
  /** Ring buffer of recent health snapshots for trend visualization. */
  healthHistory: HealthSnapshot[]
  /** Currently detected health issues sorted by severity. */
  issues: HealthIssue[]
  /** True during the initial health computation. */
  healthLoading: boolean

  /** Per-vertex bottleneck scores from the bottleneck analyzer. */
  bottleneckScores: BottleneckScore[]
  /** Optimization recommendations sorted by score descending. */
  recommendations: Recommendation[]
  /** Filter bottleneck analysis to a specific job, or null for all jobs. */
  selectedBottleneckJobId: string | null
  /** True during the initial bottleneck analysis computation. */
  bottleneckLoading: boolean

  /** Subscribe to cluster-store and compute initial snapshot (guarded — runs once). */
  initialize: () => void
  /** Start the staggered job detail polling interval for bottleneck data. */
  startPolling: () => void
  /** Stop polling, unsubscribe from cluster-store, and clear caches. */
  stopPolling: () => void
  /** Set the job filter for bottleneck analysis and re-run analysis. */
  setSelectedBottleneckJob: (jobId: string | null) => void
  /** Force a bottleneck analysis refresh with the current selection. */
  refreshBottleneckAnalysis: () => void
}

const RING_BUFFER_SIZE = 60
let insightsPollInterval: ReturnType<typeof setInterval> | null = null
let insightsInitialized = false
let unsubClusterStore: (() => void) | null = null

// Staggered job detail fetch state
let fetchQueue: string[] = []
let fetchQueuePtr = 0

const healthRingBuffer = new RingBuffer<HealthSnapshot>(RING_BUFFER_SIZE)

// Cache of fully-detailed jobs (with plan, backpressure, subtaskMetrics).
// Overview jobs only have summary data — detail fields are null/empty.
// The staggered fetch populates this cache so bottleneck analysis has
// the vertex-level data it needs.
const jobDetailsCache = new Map<string, FlinkJob>()

/** Run bottleneck analysis on cached job details, optionally filtered to a single job. */
function computeBottleneckState(selectedJobId: string | null): {
  bottleneckScores: BottleneckScore[]
  recommendations: Recommendation[]
} {
  const { runningJobs } = useClusterStore.getState()

  // Use cached detail jobs where available, fall back to overview jobs
  const enrichedJobs = runningJobs.map((j) => jobDetailsCache.get(j.id) ?? j)
  const jobsToAnalyze = selectedJobId
    ? enrichedJobs.filter((j) => j.id === selectedJobId)
    : enrichedJobs

  let allScores: BottleneckScore[] = []
  let allRecommendations: Recommendation[] = []

  for (const job of jobsToAnalyze) {
    const { scores, recommendations: recs } = analyzeJob(job)
    allScores = allScores.concat(scores)
    allRecommendations = allRecommendations.concat(recs)
  }

  // Sort recommendations by score descending globally
  allRecommendations.sort((a, b) => b.score - a.score)

  return { bottleneckScores: allScores, recommendations: allRecommendations }
}

/** Recompute health snapshot, issues, and bottleneck analysis from current cluster-store state. */
function computeAndSet(set: (partial: Partial<InsightsState>) => void) {
  const { overview, runningJobs, completedJobs, taskManagers } =
    useClusterStore.getState()

  const allJobs = [...runningJobs, ...completedJobs]
  const snapshot = computeHealthSnapshot(overview, allJobs, taskManagers)
  const issues = detectIssues(overview, allJobs, taskManagers)

  healthRingBuffer.push(snapshot)

  // Bottleneck analysis — reuses the same cluster-store data
  const selectedJobId = useInsightsStore.getState().selectedBottleneckJobId
  const { bottleneckScores, recommendations } =
    computeBottleneckState(selectedJobId)

  set({
    currentHealth: snapshot,
    healthHistory: healthRingBuffer.toArray(),
    issues,
    healthLoading: false,
    bottleneckScores,
    recommendations,
    bottleneckLoading: false,
  })
}

/** Fetch detail for up to 2 running jobs per tick and cache for bottleneck analysis. */
async function staggeredFetchJobDetails() {
  const { runningJobs } = useClusterStore.getState()
  const runningIds = runningJobs.map((j) => j.id)

  // Evict cached jobs that are no longer running
  const runningSet = new Set(runningIds)
  for (const cachedId of jobDetailsCache.keys()) {
    if (!runningSet.has(cachedId)) jobDetailsCache.delete(cachedId)
  }

  // Sync fetch queue with current running jobs
  fetchQueue = runningIds
  if (fetchQueue.length === 0) return

  // Wrap pointer if needed
  if (fetchQueuePtr >= fetchQueue.length) fetchQueuePtr = 0

  // Dequeue up to 2 jobs per tick
  const batch = fetchQueue.slice(fetchQueuePtr, fetchQueuePtr + 2)
  fetchQueuePtr =
    (fetchQueuePtr + batch.length) % Math.max(1, fetchQueue.length)

  // Fetch details and cache them for bottleneck analysis
  const results = await Promise.allSettled(
    batch.map((id) => fetchJobDetailApi(id)),
  )
  for (const result of results) {
    if (result.status === "fulfilled") {
      jobDetailsCache.set(result.value.id, result.value)
    }
  }
}

export const useInsightsStore = create<InsightsState>((set) => ({
  currentHealth: null,
  healthHistory: [],
  issues: [],
  healthLoading: true,

  // Bottleneck analysis
  bottleneckScores: [],
  recommendations: [],
  selectedBottleneckJobId: null,
  bottleneckLoading: true,

  initialize: () => {
    if (insightsInitialized) return
    insightsInitialized = true

    // Subscribe to cluster-store changes for immediate reactivity
    unsubClusterStore = useClusterStore.subscribe(() => {
      computeAndSet(set)
    })

    // Compute initial snapshot from current cluster-store state
    computeAndSet(set)

    // Kick off initial staggered fetch so bottleneck data appears
    // without waiting for the first polling tick
    staggeredFetchJobDetails().then(() => computeAndSet(set))
  },

  startPolling: () => {
    if (insightsPollInterval) return
    const intervalMs = useConfigStore.getState().config?.pollIntervalMs ?? 5000

    insightsPollInterval = setInterval(async () => {
      await staggeredFetchJobDetails()
      computeAndSet(set)
    }, intervalMs)
  },

  stopPolling: () => {
    if (insightsPollInterval) {
      clearInterval(insightsPollInterval)
      insightsPollInterval = null
    }
    if (unsubClusterStore) {
      unsubClusterStore()
      unsubClusterStore = null
    }
    jobDetailsCache.clear()
    insightsInitialized = false
  },

  setSelectedBottleneckJob: (jobId: string | null) => {
    set({ selectedBottleneckJobId: jobId })
    // Re-run analysis with new filter
    const { bottleneckScores, recommendations } = computeBottleneckState(jobId)
    set({ bottleneckScores, recommendations })
  },

  refreshBottleneckAnalysis: () => {
    const selectedJobId = useInsightsStore.getState().selectedBottleneckJobId
    const { bottleneckScores, recommendations } =
      computeBottleneckState(selectedJobId)
    set({ bottleneckScores, recommendations, bottleneckLoading: false })
  },
}))
