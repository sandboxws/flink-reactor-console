import {
  ANALYSIS_THRESHOLDS,
  LOW_CARDINALITY_PATTERNS,
  SHUFFLE_RISK_LEVELS,
} from "../constants"
import type {
  FlinkAntiPattern,
  FlinkOperatorNode,
  ShuffleStrategy,
} from "../types"

interface SkewAnalysisResult {
  antiPatterns: FlinkAntiPattern[]
}

function isLowCardinalityField(fieldName: string): boolean {
  const name = fieldName.toLowerCase()

  for (const pattern of LOW_CARDINALITY_PATTERNS) {
    if (pattern.test(name)) {
      return true
    }
  }

  return false
}

function isKeyedOperation(node: FlinkOperatorNode): boolean {
  return (
    node.category === "aggregation" ||
    node.category === "join" ||
    node.category === "deduplication" ||
    node.category === "window"
  )
}

function getKeyFields(node: FlinkOperatorNode): string[] {
  const keys: string[] = []

  if (node.groupByKeys) {
    keys.push(...node.groupByKeys)
  }

  const description = node.description || ""

  const groupByMatch = description.match(/groupBy=\[([^\]]*)\]/)
  if (groupByMatch && groupByMatch[1]) {
    const fields = groupByMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const field of fields) {
      if (!keys.includes(field)) {
        keys.push(field)
      }
    }
  }

  const partitionByMatch = description.match(/partitionBy=\[([^\]]*)\]/)
  if (partitionByMatch && partitionByMatch[1]) {
    const fields = partitionByMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const field of fields) {
      if (!keys.includes(field)) {
        keys.push(field)
      }
    }
  }

  return keys
}

function getInputShuffleStrategies(node: FlinkOperatorNode): ShuffleStrategy[] {
  return node.inputs.map((input) => input.shipStrategy)
}

function analyzeOperatorSkew(node: FlinkOperatorNode): FlinkAntiPattern[] {
  const antiPatterns: FlinkAntiPattern[] = []

  if (!isKeyedOperation(node)) {
    return antiPatterns
  }

  const keyFields = getKeyFields(node)
  const shuffleStrategies = getInputShuffleStrategies(node)

  const lowCardinalityKeys = keyFields.filter(isLowCardinalityField)

  if (lowCardinalityKeys.length > 0) {
    const severity =
      keyFields.length === lowCardinalityKeys.length ? "critical" : "warning"

    antiPatterns.push({
      id: `ap-low-cardinality-${node.id}`,
      nodeId: node.id,
      severity,
      type: "data-skew-low-cardinality",
      title: "Low-Cardinality Key Detected",
      description: `Key field(s) "${lowCardinalityKeys.join(", ")}" likely have low cardinality, which can cause severe data skew.`,
      suggestion:
        "Enable local-global aggregation with mini-batch to reduce skew impact.",
      flinkConfig: `SET 'table.exec.mini-batch.enabled' = 'true';
SET 'table.exec.mini-batch.allow-latency' = '5s';
SET 'table.exec.mini-batch.size' = '5000';
SET 'table.optimizer.agg-phase-strategy' = 'TWO_PHASE';`,
    })
  }

  // Check for NULL key risk
  for (const field of keyFields) {
    const fieldLower = field.toLowerCase()
    const description = (node.description || "").toLowerCase()
    const explicitNullableName =
      fieldLower.includes("nullable") || fieldLower.includes("optional")
    const explicitNullEvidence =
      description.includes(`${fieldLower} is null`) ||
      description.includes(`isnull(${fieldLower})`) ||
      description.includes(`nullif(${fieldLower}`)

    if (explicitNullableName || explicitNullEvidence) {
      antiPatterns.push({
        id: `ap-null-key-${node.id}-${field}`,
        nodeId: node.id,
        severity: "info",
        type: "data-skew-null-key",
        title: "Potential NULL Key Concentration",
        description: `Key field "${field}" may have many NULL values, which will all hash to the same partition.`,
        suggestion:
          "Filter out NULL keys or use COALESCE to replace NULLs with unique values.",
        sqlRewrite: `-- Filter NULL keys:\nWHERE ${field} IS NOT NULL\n\n-- Or replace with default:\nCOALESCE(${field}, 'unknown_' || UUID())`,
      })
    }
  }

  // Hash partitioning risk — only when key fields could not be determined
  const hasHashInput = shuffleStrategies.some((s) => s === "HASH")
  const hasHighRiskShuffle = shuffleStrategies.some(
    (s) => SHUFFLE_RISK_LEVELS[s] === "high",
  )

  if (
    hasHashInput &&
    hasHighRiskShuffle &&
    lowCardinalityKeys.length === 0 &&
    keyFields.length === 0
  ) {
    antiPatterns.push({
      id: `ap-hash-skew-risk-${node.id}`,
      nodeId: node.id,
      severity: "info",
      type: "hash-before-skew",
      title: "Hash Partition Before Keyed Operation",
      description: `Data is hash-partitioned before this operation but key fields could not be determined. Monitor for data skew.`,
      suggestion:
        "If skew occurs, enable mini-batch with local-global aggregation.",
      flinkConfig: `SET 'table.exec.mini-batch.enabled' = 'true';
SET 'table.optimizer.agg-phase-strategy' = 'TWO_PHASE';`,
    })
  }

  // Parallelism vs key cardinality mismatch
  if (node.parallelism > 1 && lowCardinalityKeys.length > 0) {
    const estimatedKeyCardinality =
      ANALYSIS_THRESHOLDS.VERY_LOW_CARDINALITY_THRESHOLD
    const parallelismRatio = node.parallelism / estimatedKeyCardinality

    if (parallelismRatio > ANALYSIS_THRESHOLDS.PARALLELISM_KEY_RATIO_WARNING) {
      antiPatterns.push({
        id: `ap-parallelism-mismatch-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "data-skew-low-cardinality",
        title: "Parallelism Exceeds Key Cardinality",
        description: `Parallelism (${node.parallelism}) significantly exceeds estimated key cardinality (~${estimatedKeyCardinality}). Many tasks will be idle.`,
        suggestion: "Reduce parallelism or use REBALANCE before this operator.",
      })
    }
  }

  return antiPatterns
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

export function analyzeSkew(root: FlinkOperatorNode): SkewAnalysisResult {
  const antiPatterns: FlinkAntiPattern[] = []

  traverseOperators(root, (node) => {
    const patterns = analyzeOperatorSkew(node)
    antiPatterns.push(...patterns)
  })

  return { antiPatterns }
}
