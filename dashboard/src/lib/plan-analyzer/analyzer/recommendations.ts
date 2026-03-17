import type {
  FlinkAntiPattern,
  FlinkBottleneck,
  FlinkRecommendation,
  StateGrowthForecast,
  WatermarkHealth,
} from "../types"

interface RecommendationInput {
  antiPatterns: FlinkAntiPattern[]
  bottlenecks: FlinkBottleneck[]
  stateForecasts: StateGrowthForecast[]
  watermarkHealth: WatermarkHealth[]
  totalEstimatedState24h: number
}

export function generateRecommendations(
  input: RecommendationInput,
): FlinkRecommendation[] {
  const recommendations: FlinkRecommendation[] = []

  for (const pattern of input.antiPatterns) {
    const rec = antiPatternToRecommendation(pattern)
    if (rec) {
      recommendations.push(rec)
    }
  }

  // Global state TTL recommendation if total state > 10GB
  if (input.totalEstimatedState24h > 10 * 1024 * 1024 * 1024) {
    const hasStateTTLRec = recommendations.some((r) =>
      r.sqlConfig?.includes("state.ttl"),
    )
    if (!hasStateTTLRec) {
      recommendations.push({
        id: "rec-global-state-ttl",
        severity: "critical",
        category: "state",
        title: "Configure Global State TTL",
        description: `Estimated total state after 24h is ${formatBytes(input.totalEstimatedState24h)}. Configure state TTL to prevent unbounded growth.`,
        affectedOperators: input.stateForecasts
          .filter((f) => f.growthPattern !== "bounded")
          .map((f) => f.operatorId),
        evidence:
          "Multiple stateful operators with unbounded or linear growth patterns",
        solution: "Set a global state TTL based on your business requirements.",
        sqlConfig: "SET 'table.exec.state.ttl' = '24h';",
      })
    }
  }

  // Mini-batch recommendation for skew
  const hasSkewPattern = input.antiPatterns.some(
    (p) => p.type.includes("skew") || p.type.includes("cardinality"),
  )
  const hasMiniBatchRec = recommendations.some((r) =>
    r.sqlConfig?.includes("mini-batch"),
  )
  if (hasSkewPattern && !hasMiniBatchRec) {
    recommendations.push({
      id: "rec-enable-minibatch",
      severity: "warning",
      category: "skew",
      title: "Enable Mini-Batch Processing",
      description:
        "Mini-batch processing with local-global aggregation can significantly reduce data skew impact.",
      affectedOperators: input.antiPatterns
        .filter((p) => p.type.includes("skew"))
        .map((p) => p.nodeId),
      evidence: "Data skew patterns detected in keyed operations",
      solution: "Enable mini-batch mode with two-phase aggregation.",
      sqlConfig: `SET 'table.exec.mini-batch.enabled' = 'true';
SET 'table.exec.mini-batch.allow-latency' = '5s';
SET 'table.exec.mini-batch.size' = '5000';
SET 'table.optimizer.agg-phase-strategy' = 'TWO_PHASE';`,
    })
  }

  // Watermark recommendations
  for (const health of input.watermarkHealth) {
    if (!health.hasWatermark && health.issues.length > 0) {
      const hasWatermarkRec = recommendations.some(
        (r) =>
          r.affectedOperators.includes(health.sourceId) &&
          r.category === "watermark",
      )
      if (!hasWatermarkRec) {
        recommendations.push({
          id: `rec-watermark-${health.sourceId}`,
          severity: "critical",
          category: "watermark",
          title: `Add Watermark to ${health.sourceName}`,
          description:
            "Source is used in event-time operations but has no watermark definition.",
          affectedOperators: [health.sourceId],
          evidence: health.issues.join("; "),
          solution: "Add a WATERMARK clause to the table definition.",
          ddlFix: `-- Add watermark to ${health.sourceName}:
WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND`,
        })
      }
    }
  }

  // Checkpoint recommendations for large state (> 1GB)
  if (input.totalEstimatedState24h > 1024 * 1024 * 1024) {
    recommendations.push({
      id: "rec-checkpoint-config",
      severity: "optimization",
      category: "checkpoint",
      title: "Optimize Checkpoint Configuration",
      description:
        "With significant state, consider optimizing checkpoint settings for reliability.",
      affectedOperators: [],
      evidence: `Estimated state: ${formatBytes(input.totalEstimatedState24h)}`,
      solution:
        "Configure checkpointing with appropriate intervals and use incremental checkpoints.",
      sqlConfig: `SET 'execution.checkpointing.interval' = '3min';
SET 'execution.checkpointing.min-pause' = '1min';
SET 'state.backend.type' = 'rocksdb';
SET 'state.backend.incremental' = 'true';`,
    })
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, optimization: 2 }
  recommendations.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  )

  // Deduplicate
  const seen = new Set<string>()
  return recommendations.filter((rec) => {
    const key = `${rec.title}-${rec.category}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function antiPatternToRecommendation(
  pattern: FlinkAntiPattern,
): FlinkRecommendation | null {
  const categoryMap: Record<string, FlinkRecommendation["category"]> = {
    "unbounded-state-join": "join",
    "unbounded-state-aggregate": "state",
    "missing-watermark": "watermark",
    "watermark-not-pushed-down": "watermark",
    "data-skew-low-cardinality": "skew",
    "data-skew-null-key": "skew",
    "sync-lookup-join": "join",
    "lookup-no-cache": "join",
    "changelog-incompatible": "state",
    "missing-primary-key": "state",
    "large-window": "window",
    "sliding-window-pane-explosion": "window",
    "session-no-timeout": "window",
    "count-distinct-high-cardinality": "state",
    "broadcast-large-table": "parallelism",
    "hash-before-skew": "skew",
  }

  return {
    id: `rec-${pattern.id}`,
    severity:
      pattern.severity === "critical"
        ? "critical"
        : pattern.severity === "warning"
          ? "warning"
          : "optimization",
    category: categoryMap[pattern.type] || "state",
    title: pattern.title,
    description: pattern.description,
    affectedOperators: [pattern.nodeId],
    evidence: pattern.description,
    solution: pattern.suggestion,
    sqlConfig: pattern.flinkConfig,
    ddlFix: pattern.ddlFix,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
