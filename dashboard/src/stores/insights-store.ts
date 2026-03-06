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
} from "@/data/cluster-types"
import { fetchJobDetail as fetchJobDetailApi } from "@/lib/graphql-api-client"
import { useClusterStore } from "./cluster-store"
import { useConfigStore } from "./config-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthSubScore = {
  name: string
  score: number
  weight: number
  status: "healthy" | "warning" | "critical"
  detail: string
}

export type HealthIssue = {
  id: string
  severity: "critical" | "warning" | "info"
  message: string
  source: string
  timestamp: Date
}

export type HealthSnapshot = {
  timestamp: Date
  score: number
  subScores: HealthSubScore[]
}

// ---------------------------------------------------------------------------
// Ring buffer — O(1) push, no reallocation
// ---------------------------------------------------------------------------

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

function scoreToStatus(score: number): "healthy" | "warning" | "critical" {
  if (score >= 80) return "healthy"
  if (score >= 50) return "warning"
  return "critical"
}

// ---------------------------------------------------------------------------
// Sub-score computation functions
// ---------------------------------------------------------------------------

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
  currentHealth: HealthSnapshot | null
  healthHistory: HealthSnapshot[]
  issues: HealthIssue[]
  healthLoading: boolean

  // Bottleneck analysis
  bottleneckScores: BottleneckScore[]
  recommendations: Recommendation[]
  selectedBottleneckJobId: string | null
  bottleneckLoading: boolean

  initialize: () => void
  startPolling: () => void
  stopPolling: () => void
  setSelectedBottleneckJob: (jobId: string | null) => void
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
