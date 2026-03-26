/** Health score and bottleneck analysis types for the Insights domain. */

// --- Health score types ---

/** A sub-category health score contributing to the overall cluster health. */
export type HealthSubScore = {
  /** Sub-score category name (e.g. "Checkpoint Health", "Backpressure"). */
  name: string
  /** Score value (0–100). */
  score: number
  /** Weight of this sub-score in the overall composite (0.0–1.0). */
  weight: number
  status: "healthy" | "warning" | "critical"
  /** Human-readable explanation of the score. */
  detail: string
}

/** A health issue detected by the health scoring engine. */
export type HealthIssue = {
  id: string
  severity: "critical" | "warning" | "info"
  message: string
  /** Component or subsystem that reported the issue. */
  source: string
  timestamp: Date
}

/** A point-in-time health snapshot with overall score and sub-scores. */
export type HealthSnapshot = {
  timestamp: Date
  /** Overall health score (0–100). */
  score: number
  subScores: HealthSubScore[]
}

// --- Bottleneck analysis types ---

/** Severity level of a detected bottleneck. */
export type BottleneckSeverity = "low" | "medium" | "high"

/** Composite bottleneck score for a single vertex in a Flink job. */
export type BottleneckScore = {
  vertexId: string
  vertexName: string
  jobId: string
  jobName: string
  parallelism: number
  /** Composite bottleneck score (0–100). */
  score: number
  severity: BottleneckSeverity
  /** Individual factor scores contributing to the composite (each 0–100). */
  factors: {
    backpressure: number
    busyTime: number
    throughputRatio: number
    skew: number
  }
}

/** Category of optimization recommendation. */
export type RecommendationType =
  | "increase-parallelism"
  | "data-skew"
  | "slow-operator"
  | "backpressure-cascade"

/** An actionable optimization recommendation for a specific vertex. */
export type Recommendation = {
  type: RecommendationType
  vertexId: string
  vertexName: string
  jobId: string
  jobName: string
  /** Priority score (0–100) — higher means more impactful. */
  score: number
  message: string
  /** Detailed explanation with evidence and suggested actions. */
  detail: string
}
