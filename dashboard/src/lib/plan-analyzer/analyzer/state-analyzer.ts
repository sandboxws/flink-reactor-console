import { formatBytes } from "@flink-reactor/ui"
import {
  ANALYSIS_THRESHOLDS,
  OPERATOR_STATE_GROWTH,
  OPERATOR_STATE_TYPES,
  STATEFUL_OPERATORS,
} from "../constants"
import type {
  FlinkAntiPattern,
  FlinkOperatorNode,
  FlinkStateType,
  StateGrowthForecast,
  StateGrowthPattern,
} from "../types"

interface StateAnalysisResult {
  forecasts: StateGrowthForecast[]
  antiPatterns: FlinkAntiPattern[]
  totalEstimatedState24h: number
  totalEstimatedState7d: number
}

function estimateKeyCardinality(node: FlinkOperatorNode): number {
  const groupByKeys = node.groupByKeys || []

  if (groupByKeys.length === 0) {
    return ANALYSIS_THRESHOLDS.LOW_CARDINALITY_THRESHOLD
  }

  let hasLowCardinalityKey = false
  for (const key of groupByKeys) {
    const keyLower = key.toLowerCase()
    if (
      keyLower.includes("country") ||
      keyLower.includes("status") ||
      keyLower.includes("type") ||
      keyLower.includes("category") ||
      keyLower.includes("gender") ||
      keyLower.includes("region") ||
      keyLower.match(/^is_/) ||
      keyLower.match(/^has_/)
    ) {
      hasLowCardinalityKey = true
      break
    }
  }

  if (hasLowCardinalityKey) {
    return ANALYSIS_THRESHOLDS.VERY_LOW_CARDINALITY_THRESHOLD
  }

  return 100000
}

function estimateStateSize(
  node: FlinkOperatorNode,
  growthPattern: StateGrowthPattern,
  hours: number,
): number {
  const bytesPerKey = ANALYSIS_THRESHOLDS.ESTIMATED_BYTES_PER_KEY
  const bytesPerRecord = ANALYSIS_THRESHOLDS.ESTIMATED_BYTES_PER_RECORD
  const recordsPerSecond = 1000

  switch (growthPattern) {
    case "bounded": {
      const keyCardinality = estimateKeyCardinality(node)
      return keyCardinality * bytesPerKey
    }
    case "linear": {
      const keyCardinality = estimateKeyCardinality(node)
      const newKeysPerHour = keyCardinality * 0.1
      return keyCardinality * bytesPerKey + newKeysPerHour * hours * bytesPerKey
    }
    case "unbounded": {
      const recordsPerHour = recordsPerSecond * 3600
      return recordsPerHour * hours * bytesPerRecord
    }
    default:
      return 0
  }
}

function analyzeOperatorState(node: FlinkOperatorNode): {
  forecast: StateGrowthForecast | null
  antiPatterns: FlinkAntiPattern[]
} {
  const antiPatterns: FlinkAntiPattern[] = []

  if (!STATEFUL_OPERATORS.has(node.operatorType)) {
    return { forecast: null, antiPatterns }
  }

  let stateType: FlinkStateType =
    OPERATOR_STATE_TYPES[node.operatorType] || "ValueState"
  let growthPattern: StateGrowthPattern =
    OPERATOR_STATE_GROWTH[node.operatorType] || "linear"

  const ttlConfigured = node.stateInfo?.ttlConfigured || false

  // Special handling for joins
  if (node.joinInfo) {
    if (
      node.joinInfo.joinType === "RegularJoin" &&
      node.joinInfo.leftInputSpec === "NoUniqueKey" &&
      node.joinInfo.rightInputSpec === "NoUniqueKey" &&
      !node.joinInfo.hasIntervalCondition &&
      !ttlConfigured
    ) {
      growthPattern = "unbounded"
      stateType = "MapState"

      antiPatterns.push({
        id: `ap-unbounded-join-${node.id}`,
        nodeId: node.id,
        severity: "critical",
        type: "unbounded-state-join",
        title: "Unbounded State in Regular Join",
        description: `This join keeps ALL records from both sides indefinitely. Both inputs have NoUniqueKey specification.`,
        suggestion:
          "Use an interval join, temporal join, or configure state TTL.",
        flinkConfig: "SET 'table.exec.state.ttl' = '24h';",
        sqlRewrite: `-- Add interval condition:\nWHERE a.event_time BETWEEN b.event_time - INTERVAL '1' HOUR AND b.event_time + INTERVAL '1' HOUR`,
      })
    }
  }

  // Check for high-cardinality COUNT DISTINCT
  const aggregateFunctions = node.aggregateFunctions || []
  const selectExpressions = node.selectExpressions || []
  const allExpressions = [...aggregateFunctions, ...selectExpressions]

  for (const expr of allExpressions) {
    if (
      expr.toLowerCase().includes("count(distinct") ||
      expr.toLowerCase().includes("count_distinct")
    ) {
      const fieldMatch = expr.match(/distinct\s+(\w+)/i)
      const field = fieldMatch?.[1] || "field"

      if (
        field.toLowerCase().includes("id") ||
        field.toLowerCase().includes("session") ||
        field.toLowerCase().includes("user")
      ) {
        antiPatterns.push({
          id: `ap-count-distinct-${node.id}`,
          nodeId: node.id,
          severity: "warning",
          type: "count-distinct-high-cardinality",
          title: "High-Cardinality COUNT DISTINCT",
          description: `COUNT(DISTINCT ${field}) on a potentially high-cardinality field will store all unique values in state.`,
          suggestion:
            "Consider using approximate count distinct (APPROX_COUNT_DISTINCT) or split distinct optimization.",
          flinkConfig:
            "SET 'table.optimizer.distinct-agg.split.enabled' = 'true';",
        })
      }
    }
  }

  // Calculate state size estimates
  const size1h = estimateStateSize(node, growthPattern, 1)
  const size24h = estimateStateSize(node, growthPattern, 24)
  const size7d = estimateStateSize(node, growthPattern, 168)

  if (size24h > ANALYSIS_THRESHOLDS.STATE_SIZE_CRITICAL_MB * 1024 * 1024) {
    if (!antiPatterns.some((p) => p.type === "unbounded-state-join")) {
      antiPatterns.push({
        id: `ap-large-state-${node.id}`,
        nodeId: node.id,
        severity: "critical",
        type: "unbounded-state-aggregate",
        title: "Very Large State Growth",
        description: `Estimated state size after 24h: ${formatBytes(size24h)}. This may cause out-of-memory issues.`,
        suggestion: "Configure state TTL or reduce key cardinality.",
        flinkConfig: "SET 'table.exec.state.ttl' = '24h';",
      })
    }
  } else if (
    size24h >
    ANALYSIS_THRESHOLDS.STATE_SIZE_WARNING_MB * 1024 * 1024
  ) {
    antiPatterns.push({
      id: `ap-state-warning-${node.id}`,
      nodeId: node.id,
      severity: "warning",
      type: "unbounded-state-aggregate",
      title: "Large State Growth",
      description: `Estimated state size after 24h: ${formatBytes(size24h)}. Monitor state size carefully.`,
      suggestion: "Consider configuring state TTL for this operator.",
      flinkConfig: "SET 'table.exec.state.ttl' = '24h';",
    })
  }

  const forecast: StateGrowthForecast = {
    operatorId: node.id,
    operatorName: node.operation || node.operatorType,
    stateType,
    growthPattern,
    estimatedSize1h: size1h,
    estimatedSize24h: size24h,
    estimatedSize7d: size7d,
    ttlConfigured,
    warning:
      growthPattern === "unbounded" && !ttlConfigured
        ? "Unbounded state growth without TTL"
        : undefined,
  }

  return { forecast, antiPatterns }
}

function traverseOperators(
  node: FlinkOperatorNode,
  visitor: (node: FlinkOperatorNode) => void,
): void {
  visitor(node)
  for (const child of node.children) {
    traverseOperators(child, visitor)
  }
}

export function analyzeState(root: FlinkOperatorNode): StateAnalysisResult {
  const forecasts: StateGrowthForecast[] = []
  const antiPatterns: FlinkAntiPattern[] = []

  traverseOperators(root, (node) => {
    const result = analyzeOperatorState(node)
    if (result.forecast) {
      forecasts.push(result.forecast)
    }
    antiPatterns.push(...result.antiPatterns)
  })

  const totalEstimatedState24h = forecasts.reduce(
    (sum, f) => sum + f.estimatedSize24h,
    0,
  )
  const totalEstimatedState7d = forecasts.reduce(
    (sum, f) => sum + f.estimatedSize7d,
    0,
  )

  return {
    forecasts,
    antiPatterns,
    totalEstimatedState24h,
    totalEstimatedState7d,
  }
}
