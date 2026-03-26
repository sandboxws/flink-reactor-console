/** Checkpoint analytics and alerting types for the Monitoring domain. */

import type { Checkpoint } from "./cluster"

// --- Checkpoint analytics types ---

/** Direction of a metric trend over time. */
export type TrendDirection = "stable" | "increasing" | "decreasing"

/** Checkpoint summary statistics for a single job. */
export type JobCheckpointSummary = {
  jobId: string
  jobName: string
  totalCheckpoints: number
  /** Success rate as a percentage (0–100). */
  successRate: number
  /** Average checkpoint duration in milliseconds. */
  avgDuration: number
  /** Most recent checkpoint duration in milliseconds. */
  lastDuration: number
  /** Total state size in bytes across all checkpoints. */
  totalStateSize: number
  /** Most recent checkpoint state size in bytes. */
  lastStateSize: number
  lastSuccessTime: Date | null
  /** Configured checkpoint interval in milliseconds. */
  checkpointInterval: number
  durationTrend: TrendDirection
  stateSizeTrend: TrendDirection
  /** Last 20 checkpoints for sparkline rendering. */
  recentCheckpoints: Checkpoint[]
}

/** A time-bucketed entry for the checkpoint success/failure timeline. */
export type CheckpointTimelineEntry = {
  timestamp: Date
  successes: number
  failures: number
}

/** Aggregated checkpoint statistics across all jobs. */
export type CheckpointAggregates = {
  totalCheckpoints: number
  /** Overall success rate as a percentage (0–100). */
  overallSuccessRate: number
  /** Average duration in milliseconds. */
  avgDuration: number
  /** Total state size in bytes. */
  totalStateSize: number
}

// --- Alert types ---

/** Severity level of an alert. */
export type AlertSeverity = "info" | "warning" | "critical"

/** An active alert triggered by a monitoring rule. */
export type ActiveAlert = {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  message: string
  /** Current metric value that triggered the alert. */
  currentValue: number
  /** Threshold value defined in the alert rule. */
  threshold: number
  triggeredAt: Date
  acknowledged: boolean
}
