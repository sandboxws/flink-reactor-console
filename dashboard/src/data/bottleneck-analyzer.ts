/**
 * Bottleneck analyzer -- pure scoring and recommendation engine.
 *
 * Computes composite bottleneck scores for Flink job vertices using
 * backpressure, busy-time, throughput-ratio, and skew factors, then generates
 * actionable recommendations (increase parallelism, fix data skew, etc.).
 *
 * All functions are pure: no store access, no side effects.
 *
 * @module
 */

import type {
  FlinkJob,
  JobEdge,
  JobVertex,
  SubtaskMetrics,
  VertexBackPressure,
} from "./cluster-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity classification derived from the composite bottleneck score. */
export type BottleneckSeverity = "low" | "medium" | "high"

/** Composite bottleneck score for a single job vertex. */
export type BottleneckScore = {
  vertexId: string
  vertexName: string
  jobId: string
  jobName: string
  parallelism: number
  score: number // 0-100 composite
  severity: BottleneckSeverity
  factors: {
    backpressure: number // 0-100
    busyTime: number // 0-100
    throughputRatio: number // 0-100
    skew: number // 0-100
  }
}

/** Category of actionable recommendation produced by the analyzer. */
export type RecommendationType =
  | "increase-parallelism"
  | "data-skew"
  | "slow-operator"
  | "backpressure-cascade"

/** An actionable recommendation for resolving a detected bottleneck. */
export type Recommendation = {
  type: RecommendationType
  vertexId: string
  vertexName: string
  jobId: string
  jobName: string
  score: number
  message: string
  detail: string
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

/** Relative weights for each factor in the composite bottleneck score (must sum to 1.0). */
const WEIGHTS = {
  backpressure: 0.4,
  busyTime: 0.3,
  throughputRatio: 0.2,
  skew: 0.1,
} as const

// ---------------------------------------------------------------------------
// Severity thresholds
// ---------------------------------------------------------------------------

/** Map a numeric bottleneck score (0-100) to a severity label. */
function scoreSeverity(score: number): BottleneckSeverity {
  if (score <= 30) return "low"
  if (score <= 60) return "medium"
  return "high"
}

// ---------------------------------------------------------------------------
// Factor computation helpers
// ---------------------------------------------------------------------------

/** Derive a 0-100 backpressure factor from per-subtask ratios or the vertex-level label. */
function computeBackpressureFactor(bp: VertexBackPressure | undefined): number {
  if (!bp) return 0

  // If per-subtask ratios are available, use average ratio
  if (bp.subtasks && bp.subtasks.length > 0) {
    const avgRatio =
      bp.subtasks.reduce((sum, s) => sum + s.ratio, 0) / bp.subtasks.length
    return Math.round(avgRatio * 100)
  }

  // Fall back to level-based mapping
  switch (bp.level) {
    case "ok":
      return 0
    case "low":
      return 50
    case "high":
      return 100
    default:
      return 0
  }
}

/** Convert busy-time (ms per second) to a 0-100 utilization factor. */
function computeBusyTimeFactor(busyTimeMsPerSecond: number): number {
  // 1000ms/s means fully busy = 100
  return Math.min(100, Math.round((busyTimeMsPerSecond / 1000) * 100))
}

/** Compute a 0-100 throughput drop factor from input/output record counts. */
function computeThroughputRatioFactor(
  recordsIn: number,
  recordsOut: number,
): number {
  if (recordsIn <= 0) return 0
  const dropRatio = 1 - recordsOut / recordsIn
  return Math.min(100, Math.max(0, Math.round(dropRatio * 100)))
}

/**
 * Compute skew factor from subtask metrics.
 * Skew = (max - median) / median × 100, capped at 100.
 * Returns 0 if no subtask data is available.
 */
export function computeSkewFactor(subtaskMetrics?: SubtaskMetrics[]): number {
  if (!subtaskMetrics || subtaskMetrics.length < 2) return 0

  const outputs = subtaskMetrics.map((s) => s.recordsOut).sort((a, b) => a - b)

  const median =
    outputs.length % 2 === 0
      ? (outputs[outputs.length / 2 - 1] + outputs[outputs.length / 2]) / 2
      : outputs[Math.floor(outputs.length / 2)]

  if (median <= 0) return 0

  const max = outputs[outputs.length - 1]
  const skew = ((max - median) / median) * 100
  return Math.min(100, Math.round(Math.max(0, skew)))
}

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

/**
 * Compute a bottleneck score for a single vertex.
 *
 * Formula: backpressure × 40% + busy_time × 30% + throughput_ratio × 20% + skew × 10%
 */
export function computeBottleneckScore(
  vertex: JobVertex,
  jobId: string,
  jobName: string,
  backpressure?: VertexBackPressure,
  subtaskMetrics?: SubtaskMetrics[],
): BottleneckScore {
  const bpFactor = computeBackpressureFactor(backpressure)
  const busyFactor = computeBusyTimeFactor(vertex.metrics.busyTimeMsPerSecond)
  const tpFactor = computeThroughputRatioFactor(
    vertex.metrics.recordsIn,
    vertex.metrics.recordsOut,
  )
  const skewFactor = computeSkewFactor(subtaskMetrics)

  const score = Math.round(
    bpFactor * WEIGHTS.backpressure +
      busyFactor * WEIGHTS.busyTime +
      tpFactor * WEIGHTS.throughputRatio +
      skewFactor * WEIGHTS.skew,
  )

  return {
    vertexId: vertex.id,
    vertexName: vertex.name,
    jobId,
    jobName,
    parallelism: vertex.parallelism,
    score,
    severity: scoreSeverity(score),
    factors: {
      backpressure: bpFactor,
      busyTime: busyFactor,
      throughputRatio: tpFactor,
      skew: skewFactor,
    },
  }
}

// ---------------------------------------------------------------------------
// Recommendation generation
// ---------------------------------------------------------------------------

/**
 * Generate actionable recommendations based on bottleneck scores and the
 * vertex edge graph. Sorted by score descending, deduplicated per vertex
 * (only the highest-priority recommendation is kept).
 */
export function generateRecommendations(
  scores: BottleneckScore[],
  edges: JobEdge[],
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const scoreByVertex = new Map(scores.map((s) => [s.vertexId, s]))

  for (const s of scores) {
    // 1. Increase parallelism: BP > 70 AND busy > 70
    if (s.factors.backpressure > 70 && s.factors.busyTime > 70) {
      recommendations.push({
        type: "increase-parallelism",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Increase parallelism on ${s.vertexName}`,
        detail: `High backpressure (${s.factors.backpressure}%) combined with high CPU utilization (${s.factors.busyTime}%) suggests this operator needs more parallel instances to keep up with input throughput.`,
      })
    }

    // 2. Data skew: skew factor > 50
    if (s.factors.skew > 50) {
      recommendations.push({
        type: "data-skew",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Data skew detected on ${s.vertexName}`,
        detail: `Subtask output variance is ${s.factors.skew}% above median. Some subtasks process significantly more data than others. Consider using a different partitioning strategy.`,
      })
    }

    // 3. Slow operator: busy > 80 AND throughput ratio > 50
    if (s.factors.busyTime > 80 && s.factors.throughputRatio > 50) {
      recommendations.push({
        type: "slow-operator",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Slow operator: ${s.vertexName}`,
        detail: `This operator is CPU-bound (${s.factors.busyTime}% busy) with a significant throughput drop (${s.factors.throughputRatio}%). Consider optimizing the operator logic or reducing input volume.`,
      })
    }

    // 4. Backpressure cascade: vertex has high BP AND upstream has ok/low BP
    if (s.factors.backpressure > 70) {
      // Find upstream vertices via edges (edges point source → target)
      const upstreamIds = edges
        .filter((e) => e.target === s.vertexId)
        .map((e) => e.source)

      for (const upId of upstreamIds) {
        const upstream = scoreByVertex.get(upId)
        if (upstream && upstream.factors.backpressure <= 50) {
          recommendations.push({
            type: "backpressure-cascade",
            vertexId: s.vertexId,
            vertexName: s.vertexName,
            jobId: s.jobId,
            jobName: s.jobName,
            score: s.score,
            message: `Backpressure cascade: ${s.vertexName} is slowing ${upstream.vertexName}`,
            detail: `${s.vertexName} has high backpressure (${s.factors.backpressure}%) while upstream ${upstream.vertexName} has low backpressure (${upstream.factors.backpressure}%). The downstream operator is the bottleneck causing the cascade.`,
          })
        }
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score)

  // Deduplicate per vertex: keep highest-priority recommendation
  const seen = new Set<string>()
  return recommendations.filter((r) => {
    const key = `${r.jobId}-${r.vertexId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// Convenience: analyze a full job
// ---------------------------------------------------------------------------

/**
 * Analyze an entire job: score all vertices, then generate recommendations.
 * Returns scores and recommendations for the job.
 */
export function analyzeJob(job: FlinkJob): {
  scores: BottleneckScore[]
  recommendations: Recommendation[]
} {
  if (!job.plan || job.status !== "RUNNING") {
    return { scores: [], recommendations: [] }
  }

  const scores = job.plan.vertices.map((vertex) =>
    computeBottleneckScore(
      vertex,
      job.id,
      job.name,
      job.backpressure[vertex.id],
      job.subtaskMetrics[vertex.id],
    ),
  )

  const recommendations = generateRecommendations(scores, job.plan.edges)

  return { scores, recommendations }
}
