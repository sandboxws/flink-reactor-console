// ---------------------------------------------------------------------------
// Checkpoint analytics types
// ---------------------------------------------------------------------------

import type { Checkpoint } from "./cluster"

export type TrendDirection = "stable" | "increasing" | "decreasing"

export type JobCheckpointSummary = {
  jobId: string
  jobName: string
  totalCheckpoints: number
  successRate: number // 0-100
  avgDuration: number // ms
  lastDuration: number // ms
  totalStateSize: number // bytes
  lastStateSize: number // bytes
  lastSuccessTime: Date | null
  checkpointInterval: number // ms (from config)
  durationTrend: TrendDirection
  stateSizeTrend: TrendDirection
  recentCheckpoints: Checkpoint[] // last 20 for sparkline
}

export type CheckpointTimelineEntry = {
  timestamp: Date
  successes: number
  failures: number
}

export type CheckpointAggregates = {
  totalCheckpoints: number
  overallSuccessRate: number
  avgDuration: number
  totalStateSize: number
}

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical"

export type ActiveAlert = {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  message: string
  currentValue: number
  threshold: number
  triggeredAt: Date
  acknowledged: boolean
}
