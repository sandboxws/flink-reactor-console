import {
  OPERATOR_CATEGORIES,
  OPERATOR_PATTERNS,
  STATEFUL_OPERATORS,
} from "../constants"
import type {
  ExchangeMode,
  FlinkLookupInfo,
  FlinkOperatorInput,
  FlinkOperatorNode,
  FlinkOperatorType,
  NormalizedFlinkPlan,
  ShuffleStrategy,
} from "../types"

interface JsonPlanNode {
  id: number | string
  type: string
  pact: string
  contents: string
  parallelism: number
  predecessors?: Array<{
    id: number | string
    ship_strategy: string
    side?: string
    exchange?: string
  }>
  driver_strategy?: string
  optimizer_properties?: Record<string, unknown>
}

interface JsonExecutionPlan {
  nodes: JsonPlanNode[]
  jid?: string
  name?: string
  type?: string
}

let nodeIdCounter = 0

function generateNodeId(): string {
  return `flink-node-${++nodeIdCounter}`
}

function parseOperatorType(
  typeStr: string,
  contents: string,
): FlinkOperatorType {
  const combined = `${typeStr} ${contents}`

  for (const { pattern, type } of OPERATOR_PATTERNS) {
    if (
      pattern.test(typeStr) ||
      pattern.test(contents) ||
      pattern.test(combined)
    ) {
      return type
    }
  }

  return "Unknown"
}

function parseShuffleStrategy(strategy: string): ShuffleStrategy {
  const normalized = strategy.toUpperCase()
  if (normalized.includes("FORWARD")) return "FORWARD"
  if (normalized.includes("HASH")) return "HASH"
  if (normalized.includes("REBALANCE")) return "REBALANCE"
  if (normalized.includes("BROADCAST")) return "BROADCAST"
  if (normalized.includes("RESCALE")) return "RESCALE"
  if (normalized.includes("GLOBAL")) return "GLOBAL"
  if (normalized.includes("CUSTOM")) return "CUSTOM"
  return "UNKNOWN"
}

function parseExchangeMode(exchange?: string): ExchangeMode {
  if (!exchange) return "undefined"
  const normalized = exchange.toLowerCase()
  if (normalized.includes("pipelined_bounded")) return "pipelined_bounded"
  if (normalized.includes("pipelined")) return "pipelined"
  if (normalized.includes("batch")) return "batch"
  return "undefined"
}

function extractBracketContent(
  text: string,
  prefix: string,
): string | undefined {
  const start = text.indexOf(`${prefix}=[`)
  if (start === -1) return undefined
  let depth = 0
  const begin = start + prefix.length + 2 // skip past '=['
  for (let i = begin; i < text.length; i++) {
    if (text[i] === "[") depth++
    else if (text[i] === "]") {
      if (depth === 0) return text.slice(begin, i)
      depth--
    }
  }
  return undefined
}

function splitTopLevelCommas(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++
    else if (ch === ")" || ch === "]") depth--
    if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean)
}

function extractSelectExpressions(contents: string): string[] | undefined {
  const inner = extractBracketContent(contents, "select")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractWhereCondition(contents: string): string | undefined {
  return extractBracketContent(contents, "where")
}

function extractGroupByKeys(contents: string): string[] | undefined {
  const inner = extractBracketContent(contents, "groupBy")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractAggregateFunctions(contents: string): string[] | undefined {
  const inner =
    extractBracketContent(contents, "agg") ||
    extractBracketContent(contents, "aggregates")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractRelation(contents: string): string | undefined {
  const tableMatch =
    contents.match(/table=\[\[([^\]]+)\]\]/i) ||
    contents.match(/table=\[([^\]]+)\]/i)
  if (tableMatch?.[1]) {
    const parts = tableMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return parts[parts.length - 1] || tableMatch[1].trim()
  }

  const topicMatch = contents.match(/topic=\[([^\]]+)\]/i)
  if (topicMatch?.[1]) {
    return topicMatch[1].trim()
  }

  const pathMatch = contents.match(/path=\[([^\]]+)\]/i)
  if (pathMatch?.[1]) {
    const path = pathMatch[1].trim()
    const file = path.split("/").filter(Boolean).pop()
    return file || path
  }

  return undefined
}

function extractLookupInfo(contents: string): FlinkLookupInfo | undefined {
  if (!/lookupjoin/i.test(contents)) {
    return undefined
  }

  const tableMatch = contents.match(/table=\[([^\]]+)\]/i)
  const asyncMatch = contents.match(/async=\[(true|false)\]/i)
  const asyncCapacityMatch = contents.match(/asyncCapacity=\[(\d+)\]/i)
  const asyncTimeoutMatch = contents.match(/asyncTimeout=\[(\d+)\]/i)
  const cacheMatch = contents.match(/cache=\[([^\]]+)\]/i)
  const cacheSizeMatch = contents.match(/size=(\d+)/i)
  const cacheTtlMatch = contents.match(/ttl=(\d+)/i)
  const retryMatch = contents.match(/retry=\[(true|false)\]/i)
  const retryAttemptsMatch = contents.match(/retryAttempts=\[(\d+)\]/i)

  return {
    tableName: tableMatch?.[1]?.trim() || "unknown_table",
    async: asyncMatch ? asyncMatch[1].toLowerCase() === "true" : undefined,
    asyncCapacity: asyncCapacityMatch
      ? parseInt(asyncCapacityMatch[1], 10)
      : undefined,
    asyncTimeout: asyncTimeoutMatch
      ? parseInt(asyncTimeoutMatch[1], 10)
      : undefined,
    cacheEnabled: cacheMatch ? !/none/i.test(cacheMatch[1]) : undefined,
    cacheSize: cacheSizeMatch ? parseInt(cacheSizeMatch[1], 10) : undefined,
    cacheTTL: cacheTtlMatch ? parseInt(cacheTtlMatch[1], 10) : undefined,
    retryEnabled: retryMatch
      ? retryMatch[1].toLowerCase() === "true"
      : undefined,
    retryAttempts: retryAttemptsMatch
      ? parseInt(retryAttemptsMatch[1], 10)
      : undefined,
  }
}

function parseJsonNode(
  jsonNode: JsonPlanNode,
  nodeMap: Map<string | number, string>,
): FlinkOperatorNode {
  const internalId = generateNodeId()
  nodeMap.set(jsonNode.id, internalId)

  const operatorType = parseOperatorType(jsonNode.type, jsonNode.contents)
  const category = OPERATOR_CATEGORIES[operatorType] || "unknown"
  const isStateful = STATEFUL_OPERATORS.has(operatorType)

  const inputs: FlinkOperatorInput[] = (jsonNode.predecessors || []).map(
    (pred) => ({
      operatorId: String(pred.id), // Will be resolved later
      shipStrategy: parseShuffleStrategy(pred.ship_strategy),
      exchangeMode: parseExchangeMode(pred.exchange),
      side: pred.side as "first" | "second" | undefined,
    }),
  )

  const node: FlinkOperatorNode = {
    id: internalId,
    nodeType: operatorType,
    operation: jsonNode.type,
    operatorType,
    category,
    parallelism: jsonNode.parallelism || 1,
    description: jsonNode.contents,
    inputs,
    children: [],
    rawData: jsonNode as unknown as Record<string, unknown>,
    relation: extractRelation(jsonNode.contents),

    // Extract operator-specific properties
    selectExpressions: extractSelectExpressions(jsonNode.contents),
    whereCondition: extractWhereCondition(jsonNode.contents),
    groupByKeys: extractGroupByKeys(jsonNode.contents),
    aggregateFunctions: extractAggregateFunctions(jsonNode.contents),
  }

  // Add state info for stateful operators
  if (isStateful) {
    node.stateInfo = {
      stateType: "ValueState",
      growthPattern: "linear",
      ttlConfigured: false,
    }
  }

  // Parse join-specific info
  if (category === "join") {
    const leftSpecMatch = jsonNode.contents.match(/leftInputSpec=\[(\w+)\]/)
    const rightSpecMatch = jsonNode.contents.match(/rightInputSpec=\[(\w+)\]/)
    const joinCondMatch = jsonNode.contents.match(/where=\[([^\]]+)\]/)

    node.joinInfo = {
      joinType:
        operatorType === "Join"
          ? "RegularJoin"
          : operatorType === "IntervalJoin"
            ? "IntervalJoin"
            : operatorType === "TemporalJoin"
              ? "TemporalJoin"
              : operatorType === "LookupJoin"
                ? "LookupJoin"
                : "RegularJoin",
      joinCondition: joinCondMatch?.[1],
      leftInputSpec:
        (leftSpecMatch?.[1] as "NoUniqueKey" | "HasUniqueKey") || "NoUniqueKey",
      rightInputSpec:
        (rightSpecMatch?.[1] as "NoUniqueKey" | "HasUniqueKey") ||
        "NoUniqueKey",
      hasIntervalCondition: operatorType === "IntervalJoin",
    }

    if (operatorType === "LookupJoin") {
      node.lookupInfo = extractLookupInfo(jsonNode.contents)
    }
  }

  return node
}

function buildDAG(
  nodes: FlinkOperatorNode[],
  jsonNodes: JsonPlanNode[],
  nodeMap: Map<string | number, string>,
): { root: FlinkOperatorNode; allNodes: FlinkOperatorNode[] } {
  // Create a map of internal ID to node
  const nodeById = new Map<string, FlinkOperatorNode>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
  }

  // Track which nodes are sources (no predecessors) and sinks (no one references them)
  const hasOutgoing = new Set<string>()

  // Resolve input references and build parent-child relationships
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const jsonNode = jsonNodes[i]

    // Resolve input operator IDs
    node.inputs = node.inputs.map((input) => ({
      ...input,
      operatorId: nodeMap.get(input.operatorId) || input.operatorId,
    }))

    // Build children relationships
    for (const pred of jsonNode.predecessors || []) {
      const inputNodeId = nodeMap.get(pred.id)
      if (inputNodeId) {
        const inputNode = nodeById.get(inputNodeId)
        if (inputNode) {
          if (!node.children.some((c) => c.id === inputNode.id)) {
            node.children.push(inputNode)
          }
          hasOutgoing.add(inputNode.id)
        }
      }
    }
  }

  // Find sinks (nodes that no one references as predecessor)
  const sinks = nodes.filter((n) => !hasOutgoing.has(n.id))

  let root: FlinkOperatorNode
  if (sinks.length === 0) {
    root = nodes[nodes.length - 1]
  } else if (sinks.length === 1) {
    root = sinks[0]
  } else {
    // Multiple sinks — create a virtual root
    root = {
      id: "virtual-root",
      nodeType: "MultiSink",
      operation: "Multiple Outputs",
      operatorType: "Unknown",
      category: "unknown",
      parallelism: 1,
      inputs: [],
      children: sinks,
      rawData: {},
    } as FlinkOperatorNode
  }

  return { root, allNodes: nodes }
}

function calculateMaxDepth(node: FlinkOperatorNode, currentDepth = 0): number {
  if (node.children.length === 0) {
    return currentDepth
  }
  return Math.max(
    ...node.children.map((child) => calculateMaxDepth(child, currentDepth + 1)),
  )
}

export function parseJsonPlan(input: string): NormalizedFlinkPlan {
  nodeIdCounter = 0

  let planData: JsonExecutionPlan

  try {
    const parsed = JSON.parse(input)

    if (parsed.nodes) {
      planData = parsed
    } else if (parsed.plan?.nodes) {
      planData = parsed.plan
    } else if (Array.isArray(parsed)) {
      planData = { nodes: parsed }
    } else {
      throw new Error("Invalid JSON plan structure: missing nodes array")
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${e.message}`)
    }
    throw e
  }

  if (!planData.nodes || planData.nodes.length === 0) {
    throw new Error("No operators found in plan")
  }

  const nodeMap = new Map<string | number, string>()
  const nodes = planData.nodes.map((jsonNode) =>
    parseJsonNode(jsonNode, nodeMap),
  )
  const { root, allNodes } = buildDAG(nodes, planData.nodes, nodeMap)

  const totalNodes = allNodes.length + (root.id === "virtual-root" ? 1 : 0)
  const maxDepth = calculateMaxDepth(root)

  return {
    root,
    totalNodes,
    maxDepth,
    rawPlan: input,
    format: "json",
    jobType: planData.type?.toUpperCase() === "BATCH" ? "BATCH" : "STREAMING",
  }
}
