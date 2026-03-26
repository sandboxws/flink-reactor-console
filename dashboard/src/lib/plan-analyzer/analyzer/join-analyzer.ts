/**
 * Join strategy analyzer for Flink execution plans.
 *
 * Examines join operators and detects anti-patterns: regular joins with
 * unbounded state (NoUniqueKey on both sides), synchronous lookup joins,
 * lookup joins without caching, and temporal joins missing primary keys.
 * Suggests alternative join strategies (interval, temporal, lookup) where
 * applicable.
 *
 * @module plan-analyzer/analyzer/join-analyzer
 */

import type { FlinkAntiPattern, FlinkOperatorNode } from "../types"

/** Result of join analysis containing detected anti-patterns. */
interface JoinAnalysisResult {
  antiPatterns: FlinkAntiPattern[]
}

function analyzeJoinOperator(node: FlinkOperatorNode): FlinkAntiPattern[] {
  const antiPatterns: FlinkAntiPattern[] = []

  if (node.category !== "join") {
    return antiPatterns
  }

  const joinInfo = node.joinInfo

  if (!joinInfo) {
    return antiPatterns
  }

  // Analyze regular joins
  if (joinInfo.joinType === "RegularJoin") {
    if (
      joinInfo.leftInputSpec === "NoUniqueKey" &&
      joinInfo.rightInputSpec === "NoUniqueKey" &&
      !joinInfo.hasIntervalCondition
    ) {
      const alternatives: string[] = []

      const joinCondition = joinInfo.joinCondition?.toLowerCase() || ""
      if (
        joinCondition.includes("time") ||
        joinCondition.includes("timestamp") ||
        joinCondition.includes("event")
      ) {
        alternatives.push(
          "Interval Join (if there is a time relationship between records)",
        )
      }

      alternatives.push(
        "Temporal Join (if one side is a versioned dimension table)",
      )
      alternatives.push(
        "Lookup Join (if one side is a slowly changing dimension)",
      )
      alternatives.push("Configure state TTL (may lose late-arriving matches)")

      antiPatterns.push({
        id: `ap-join-strategy-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "unbounded-state-join",
        title: "Consider Alternative Join Strategy",
        description: `Regular join between two streams with NoUniqueKey on both sides.`,
        suggestion: `Better alternatives:\n${alternatives.map((a) => `  - ${a}`).join("\n")}`,
      })
    }
  }

  // Analyze lookup joins
  if (
    joinInfo.joinType === "LookupJoin" ||
    node.operatorType === "LookupJoin"
  ) {
    const lookupInfo = node.lookupInfo

    if (lookupInfo && lookupInfo.async === false) {
      antiPatterns.push({
        id: `ap-sync-lookup-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "sync-lookup-join",
        title: "Synchronous Lookup Join",
        description:
          "Lookup join is configured synchronously, which blocks on each lookup request.",
        suggestion: "Enable async lookup for better throughput.",
        ddlFix: `ALTER TABLE ${lookupInfo?.tableName || "dimension_table"} SET (
  'lookup.async' = 'true',
  'lookup.async.capacity' = '100',
  'lookup.async.timeout' = '3min'
);`,
      })
    }

    if (lookupInfo && lookupInfo.cacheEnabled === false) {
      antiPatterns.push({
        id: `ap-lookup-no-cache-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "lookup-no-cache",
        title: "Lookup Join Without Cache",
        description:
          "Lookup join is not using cache, which increases load on the external system.",
        suggestion: "Enable lookup cache to reduce external system load.",
        ddlFix: `ALTER TABLE ${lookupInfo?.tableName || "dimension_table"} SET (
  'lookup.cache' = 'PARTIAL',
  'lookup.partial-cache.max-rows' = '50000',
  'lookup.partial-cache.expire-after-write' = '1h'
);`,
      })
    }
  }

  // Analyze temporal joins
  if (
    joinInfo.joinType === "TemporalJoin" ||
    node.operatorType === "TemporalJoin"
  ) {
    const description = node.description?.toLowerCase() || ""
    if (description.includes("nounique") || description.includes("no unique")) {
      antiPatterns.push({
        id: `ap-temporal-no-pk-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "missing-primary-key",
        title: "Temporal Join Without Primary Key",
        description:
          "Temporal join version table may be missing a primary key.",
        suggestion:
          "Add PRIMARY KEY to the version table for correct temporal join behavior.",
        ddlFix: `-- Add primary key to version table:
CREATE TABLE version_table (
  id BIGINT,
  ...
  update_time TIMESTAMP(3),
  WATERMARK FOR update_time AS update_time - INTERVAL '5' SECOND,
  PRIMARY KEY (id) NOT ENFORCED  -- Add this
);`,
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

/** Analyze all join operators in the plan tree for strategy anti-patterns. */
export function analyzeJoins(root: FlinkOperatorNode): JoinAnalysisResult {
  const antiPatterns: FlinkAntiPattern[] = []

  traverseOperators(root, (node) => {
    const patterns = analyzeJoinOperator(node)
    antiPatterns.push(...patterns)
  })

  return { antiPatterns }
}
