// ---------------------------------------------------------------------------
// Health score types (from insights store)
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
// Bottleneck analysis types (from bottleneck-analyzer)
// ---------------------------------------------------------------------------

export type BottleneckSeverity = "low" | "medium" | "high"

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

export type RecommendationType =
  | "increase-parallelism"
  | "data-skew"
  | "slow-operator"
  | "backpressure-cascade"

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
