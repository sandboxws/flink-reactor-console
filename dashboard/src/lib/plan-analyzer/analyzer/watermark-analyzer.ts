/**
 * Watermark analyzer for Flink execution plans.
 *
 * Inspects source operators for watermark definitions and detects issues:
 * missing watermarks when event-time operations exist downstream, missing
 * idle timeout configuration, overly strict or lenient bounds, and
 * inconsistent watermark definitions across multi-source plans.
 *
 * @module plan-analyzer/analyzer/watermark-analyzer
 */

import type {
  FlinkAntiPattern,
  FlinkOperatorNode,
  WatermarkHealth,
} from "../types"

/** Result of watermark analysis with per-source health and detected anti-patterns. */
interface WatermarkAnalysisResult {
  health: WatermarkHealth[]
  antiPatterns: FlinkAntiPattern[]
}

function parseDurationMs(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  const raw = String(value).trim()
  if (!raw) {
    return undefined
  }

  const direct = Number(raw)
  if (Number.isFinite(direct)) {
    return direct
  }

  const match =
    raw.match(
      /^(\d+)\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours)?$/i,
    ) ||
    raw.match(
      /^'(\d+)'\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours)$/i,
    )
  if (!match) {
    return undefined
  }

  const amount = parseInt(match[1], 10)
  const unit = (match[2] || "ms").toLowerCase()

  if (unit === "h" || unit === "hr" || unit === "hour" || unit === "hours") {
    return amount * 3600000
  }
  if (
    unit === "m" ||
    unit === "min" ||
    unit === "minute" ||
    unit === "minutes"
  ) {
    return amount * 60000
  }
  if (
    unit === "s" ||
    unit === "sec" ||
    unit === "second" ||
    unit === "seconds"
  ) {
    return amount * 1000
  }

  return amount
}

function isSourceOperator(node: FlinkOperatorNode): boolean {
  return node.category === "source"
}

function isEventTimeOperation(node: FlinkOperatorNode): boolean {
  return (
    node.category === "window" ||
    node.operatorType === "IntervalJoin" ||
    node.operatorType === "TemporalJoin" ||
    node.operatorType === "Match" ||
    (node.operatorType === "Deduplicate" && !isProcessingTimeDedup(node))
  )
}

function isProcessingTimeDedup(node: FlinkOperatorNode): boolean {
  const description = node.description?.toLowerCase() || ""
  return description.includes("proctime") || description.includes("processing")
}

function extractWatermarkInfo(
  node: FlinkOperatorNode,
): Partial<WatermarkHealth> {
  const description = node.description?.toLowerCase() || ""
  const rawData = node.rawData || {}

  let hasWatermark = false
  let watermarkExpression: string | undefined
  let maxOutOfOrderness: number | undefined
  let idleTimeout: number | undefined

  if (description.includes("watermark")) {
    hasWatermark = true

    const wmMatch = description.match(/watermark.*?as\s+([^,\]]+)/i)
    if (wmMatch) {
      watermarkExpression = wmMatch[1].trim()
    }

    const boundMatch = description.match(
      /interval\s+'?(\d+)'?\s+(second|minute|hour)/i,
    )
    if (boundMatch) {
      const value = parseInt(boundMatch[1], 10)
      const unit = boundMatch[2].toLowerCase()
      maxOutOfOrderness =
        unit === "hour"
          ? value * 3600000
          : unit === "minute"
            ? value * 60000
            : value * 1000
    }
  }

  if (rawData["scan.watermark.idle-timeout"]) {
    idleTimeout = parseDurationMs(rawData["scan.watermark.idle-timeout"])
  }

  return {
    hasWatermark,
    watermarkExpression,
    maxOutOfOrderness,
    idleTimeout,
  }
}

function analyzeSourceWatermark(
  node: FlinkOperatorNode,
  hasEventTimeDownstream: boolean,
): { health: WatermarkHealth; antiPatterns: FlinkAntiPattern[] } {
  const antiPatterns: FlinkAntiPattern[] = []
  const wmInfo = extractWatermarkInfo(node)

  const health: WatermarkHealth = {
    sourceId: node.id,
    sourceName: node.relation || node.operation || "Source",
    hasWatermark: wmInfo.hasWatermark || false,
    watermarkExpression: wmInfo.watermarkExpression,
    maxOutOfOrderness: wmInfo.maxOutOfOrderness,
    idleTimeout: wmInfo.idleTimeout,
    issues: [],
  }

  if (!health.hasWatermark && hasEventTimeDownstream) {
    health.issues.push(
      "No watermark defined but event-time operations exist downstream",
    )

    antiPatterns.push({
      id: `ap-missing-watermark-${node.id}`,
      nodeId: node.id,
      severity: "critical",
      type: "missing-watermark",
      title: "Missing Watermark Definition",
      description: `Source "${health.sourceName}" has no watermark defined, but is used in event-time operations.`,
      suggestion: "Add a WATERMARK clause to the table definition.",
      ddlFix: `CREATE TABLE ${health.sourceName} (
  ...
  event_time TIMESTAMP(3),
  WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
);`,
    })
  }

  if (health.hasWatermark && !health.idleTimeout) {
    health.issues.push(
      "No idle timeout configured - idle partitions may block watermark progress",
    )

    antiPatterns.push({
      id: `ap-no-idle-timeout-${node.id}`,
      nodeId: node.id,
      severity: "info",
      type: "watermark-not-pushed-down",
      title: "Missing Watermark Idle Timeout",
      description: `Source "${health.sourceName}" has no idle timeout configured. If some partitions become idle, watermarks may stop advancing.`,
      suggestion:
        "Configure watermark idle timeout for sources with potentially idle partitions.",
      ddlFix: `-- Add to connector options:
'scan.watermark.idle-timeout' = '60000'  -- 60 seconds`,
    })
  }

  if (
    health.maxOutOfOrderness !== undefined &&
    health.maxOutOfOrderness < 1000
  ) {
    health.issues.push(
      "Very small maxOutOfOrderness may cause excessive late data",
    )

    antiPatterns.push({
      id: `ap-strict-watermark-${node.id}`,
      nodeId: node.id,
      severity: "warning",
      type: "watermark-not-pushed-down",
      title: "Potentially Too Strict Watermark Bound",
      description: `MaxOutOfOrderness of ${health.maxOutOfOrderness}ms may be too strict, causing data to be dropped as late.`,
      suggestion: "Consider increasing the bound if you see late data.",
    })
  }

  if (
    health.maxOutOfOrderness !== undefined &&
    health.maxOutOfOrderness > 3600000
  ) {
    health.issues.push(
      "Very large maxOutOfOrderness increases latency and state",
    )

    antiPatterns.push({
      id: `ap-lenient-watermark-${node.id}`,
      nodeId: node.id,
      severity: "info",
      type: "watermark-not-pushed-down",
      title: "Very Large Watermark Bound",
      description: `MaxOutOfOrderness of ${(health.maxOutOfOrderness / 60000).toFixed(0)} minutes increases output latency and window state.`,
      suggestion: "Consider if such a large bound is necessary.",
    })
  }

  return { health, antiPatterns }
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

function findSources(root: FlinkOperatorNode): FlinkOperatorNode[] {
  const sources: FlinkOperatorNode[] = []
  traverseOperators(root, (node) => {
    if (isSourceOperator(node)) {
      sources.push(node)
    }
  })
  return sources
}

function hasEventTimeOperations(root: FlinkOperatorNode): boolean {
  let found = false
  traverseOperators(root, (node) => {
    if (isEventTimeOperation(node)) {
      found = true
    }
  })
  return found
}

/** Analyze all source operators for watermark health and detect missing/misconfigured watermarks. */
export function analyzeWatermarks(
  root: FlinkOperatorNode,
): WatermarkAnalysisResult {
  const health: WatermarkHealth[] = []
  const antiPatterns: FlinkAntiPattern[] = []

  const hasEventTime = hasEventTimeOperations(root)
  const sources = findSources(root)

  for (const source of sources) {
    const result = analyzeSourceWatermark(source, hasEventTime)
    health.push(result.health)
    antiPatterns.push(...result.antiPatterns)
  }

  if (sources.length > 1 && hasEventTime) {
    const sourcesWithWatermark = health.filter((h) => h.hasWatermark)
    const sourcesWithoutWatermark = health.filter((h) => !h.hasWatermark)

    if (sourcesWithWatermark.length > 0 && sourcesWithoutWatermark.length > 0) {
      antiPatterns.push({
        id: "ap-watermark-alignment",
        nodeId: sources[0].id,
        severity: "warning",
        type: "watermark-not-pushed-down",
        title: "Watermark Alignment Issue",
        description: `Some sources have watermarks (${sourcesWithWatermark.map((h) => h.sourceName).join(", ")}) but others don't (${sourcesWithoutWatermark.map((h) => h.sourceName).join(", ")}).`,
        suggestion:
          "Ensure all sources in joins/unions have consistent watermark definitions.",
      })
    }
  }

  return { health, antiPatterns }
}
