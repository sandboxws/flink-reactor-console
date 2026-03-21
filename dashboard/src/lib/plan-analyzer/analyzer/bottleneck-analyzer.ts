import { SHUFFLE_RISK_LEVELS, STATEFUL_OPERATORS } from "../constants"
import type { FlinkBottleneck, FlinkOperatorNode } from "../types"

interface BottleneckAnalysisResult {
  bottlenecks: FlinkBottleneck[]
}

function calculateOperatorWeight(node: FlinkOperatorNode): number {
  let weight = 1.0

  if (STATEFUL_OPERATORS.has(node.operatorType)) {
    weight *= 2.0
  }

  if (node.category === "join") {
    weight *= 2.5

    if (
      node.joinInfo?.joinType === "RegularJoin" &&
      node.joinInfo.leftInputSpec === "NoUniqueKey"
    ) {
      weight *= 1.5
    }

    if (node.operatorType === "LookupJoin") {
      weight *= 1.5
      if (node.lookupInfo?.async === false) {
        weight *= 2.0
      }
    }
  }

  if (node.category === "window") {
    weight *= 1.5
    if (node.windowInfo?.windowSize && node.windowInfo.windowSize > 3600000) {
      weight *= 1.5
    }
  }

  if (node.category === "aggregation") {
    weight *= 1.5
  }

  for (const input of node.inputs) {
    const risk = SHUFFLE_RISK_LEVELS[input.shipStrategy]
    if (risk === "high") {
      weight *= 1.5
    } else if (risk === "medium") {
      weight *= 1.2
    }
  }

  if (node.operatorType === "Match") {
    weight *= 2.0
  }

  return weight
}

function identifyBottleneckType(
  node: FlinkOperatorNode,
): "shuffle" | "state" | "network" | "cpu" {
  const hasHighRiskShuffle = node.inputs.some(
    (input) => SHUFFLE_RISK_LEVELS[input.shipStrategy] === "high",
  )
  if (hasHighRiskShuffle) {
    return "shuffle"
  }

  const hasBroadcast = node.inputs.some(
    (input) => input.shipStrategy === "BROADCAST",
  )
  if (hasBroadcast) {
    return "network"
  }

  if (STATEFUL_OPERATORS.has(node.operatorType)) {
    return "state"
  }

  return "cpu"
}

function generateBottleneckReason(node: FlinkOperatorNode): string {
  const bottleneckType = identifyBottleneckType(node)

  switch (bottleneckType) {
    case "shuffle": {
      const hashInputs = node.inputs.filter((i) => i.shipStrategy === "HASH")
      if (hashInputs.length > 0) {
        const keys = node.groupByKeys?.join(", ") || "key fields"
        return `Hash partitioning on ${keys} may cause data skew`
      }
      return "Data shuffle may be causing slowdown"
    }
    case "network": {
      const broadcastInputs = node.inputs.filter(
        (i) => i.shipStrategy === "BROADCAST",
      )
      if (broadcastInputs.length > 0) {
        return `Broadcasting data to ${node.parallelism} parallel tasks`
      }
      return "Network transfer may be a bottleneck"
    }
    case "state": {
      if (node.category === "join") {
        if (node.joinInfo?.joinType === "RegularJoin") {
          return "Regular join maintains state for both input streams"
        }
        if (node.operatorType === "LookupJoin") {
          return "Lookup join performs external lookups"
        }
        return "Join operation maintains significant state"
      }
      if (node.category === "aggregation") {
        return "Aggregation maintains state per key"
      }
      if (node.category === "window") {
        return "Window accumulates records until window closes"
      }
      return "Stateful operation may be slow due to state access"
    }
    case "cpu":
    default:
      return "CPU-intensive transformation"
  }
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

export function analyzeBottlenecks(
  root: FlinkOperatorNode,
): BottleneckAnalysisResult {
  const operatorWeights: Array<{ node: FlinkOperatorNode; weight: number }> = []

  traverseOperators(root, (node) => {
    const weight = calculateOperatorWeight(node)
    operatorWeights.push({ node, weight })
  })

  operatorWeights.sort((a, b) => b.weight - a.weight)

  const totalWeight = operatorWeights.reduce(
    (sum, { weight }) => sum + weight,
    0,
  )

  const bottlenecks: FlinkBottleneck[] = []

  let accumulatedPercentage = 0
  for (const { node, weight } of operatorWeights) {
    const percentage = (weight / totalWeight) * 100

    if (accumulatedPercentage > 80 || bottlenecks.length >= 5) {
      break
    }

    if (percentage < 10 && bottlenecks.length > 0) {
      continue
    }

    const bottleneckType = identifyBottleneckType(node)
    const shuffleStrategy = node.inputs[0]?.shipStrategy

    bottlenecks.push({
      nodeId: node.id,
      nodeName: node.operation || node.operatorType,
      percentage,
      time: weight,
      reason: generateBottleneckReason(node),
      bottleneckType,
      shuffleStrategy,
    })

    accumulatedPercentage += percentage
  }

  return { bottlenecks }
}
