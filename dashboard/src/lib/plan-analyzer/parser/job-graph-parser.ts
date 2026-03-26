/**
 * Flink job graph REST response parser.
 *
 * Parses the JSON response from `/jobs/:jid` which contains a `plan.nodes`
 * array with vertex-level operator descriptions and optional runtime metrics
 * from the `vertices` array. Resolves input references into a DAG and
 * enriches nodes with live record counts when available.
 *
 * @module plan-analyzer/parser/job-graph-parser
 */

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

/** Runtime vertex data from the Flink REST `/jobs/:jid` response. */
interface JobGraphVertex {
  id: string
  name: string
  parallelism: number
  status?: string
  "start-time"?: number
  duration?: number
  tasks?: Record<string, number>
  metrics?: {
    "read-bytes"?: number
    "write-bytes"?: number
    "read-records"?: number
    "write-records"?: number
  }
}

/** Operator node from the Flink job graph plan. */
interface JobGraphNode {
  id: string
  parallelism: number
  operator: string
  operator_strategy?: string
  description: string
  inputs?: Array<{
    num: number
    id: string
    ship_strategy: string
    exchange?: string
  }>
  optimizer_properties?: Record<string, unknown>
}

/** The plan section of a Flink job graph response. */
interface JobGraphPlan {
  jid: string
  name: string
  type?: string
  nodes: JobGraphNode[]
}

/** Top-level Flink REST `/jobs/:jid` response envelope. */
interface JobGraphResponse {
  jid: string
  name: string
  state?: string
  "start-time"?: number
  duration?: number
  vertices?: JobGraphVertex[]
  plan: JobGraphPlan
}

let nodeIdCounter = 0

function generateNodeId(): string {
  return `flink-node-${++nodeIdCounter}`
}

function parseOperatorType(
  operator: string,
  description: string,
): FlinkOperatorType {
  const combined = `${operator} ${description}`

  for (const { pattern, type } of OPERATOR_PATTERNS) {
    if (
      pattern.test(operator) ||
      pattern.test(description) ||
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
  const begin = start + prefix.length + 2
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

function extractGroupByKeys(description: string): string[] | undefined {
  const inner = extractBracketContent(description, "groupBy")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractSelectExpressions(description: string): string[] | undefined {
  const inner = extractBracketContent(description, "select")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractWhereCondition(description: string): string | undefined {
  return extractBracketContent(description, "where")
}

function extractAggregateFunctions(description: string): string[] | undefined {
  const inner =
    extractBracketContent(description, "agg") ||
    extractBracketContent(description, "aggregates")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractRelation(description: string): string | undefined {
  const tableMatch =
    description.match(/table=\[\[([^\]]+)\]\]/i) ||
    description.match(/table=\[([^\]]+)\]/i)
  if (tableMatch?.[1]) {
    const parts = tableMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return parts[parts.length - 1] || tableMatch[1].trim()
  }

  const topicMatch = description.match(/topic=\[([^\]]+)\]/i)
  if (topicMatch?.[1]) {
    return topicMatch[1].trim()
  }

  const pathMatch = description.match(/path=\[([^\]]+)\]/i)
  if (pathMatch?.[1]) {
    const p = pathMatch[1].trim()
    const file = p.split("/").filter(Boolean).pop()
    return file || p
  }

  return undefined
}

function extractLookupInfo(description: string): FlinkLookupInfo | undefined {
  if (!/lookupjoin/i.test(description)) {
    return undefined
  }

  const tableMatch = description.match(/table=\[([^\]]+)\]/i)
  const asyncMatch = description.match(/async=\[(true|false)\]/i)
  const asyncCapacityMatch = description.match(/asyncCapacity=\[(\d+)\]/i)
  const asyncTimeoutMatch = description.match(/asyncTimeout=\[(\d+)\]/i)
  const cacheMatch = description.match(/cache=\[([^\]]+)\]/i)
  const cacheSizeMatch = description.match(/size=(\d+)/i)
  const cacheTtlMatch = description.match(/ttl=(\d+)/i)
  const retryMatch = description.match(/retry=\[(true|false)\]/i)
  const retryAttemptsMatch = description.match(/retryAttempts=\[(\d+)\]/i)

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

function parseJobGraphNode(
  graphNode: JobGraphNode,
  nodeMap: Map<string, string>,
  vertexMetrics?: Map<string, JobGraphVertex>,
): FlinkOperatorNode {
  const internalId = generateNodeId()
  nodeMap.set(graphNode.id, internalId)

  const operatorType = parseOperatorType(
    graphNode.operator,
    graphNode.description,
  )
  const category = OPERATOR_CATEGORIES[operatorType] || "unknown"
  const isStateful = STATEFUL_OPERATORS.has(operatorType)

  const inputs: FlinkOperatorInput[] = (graphNode.inputs || []).map(
    (input) => ({
      operatorId: input.id,
      shipStrategy: parseShuffleStrategy(input.ship_strategy),
      exchangeMode: parseExchangeMode(input.exchange),
    }),
  )

  const metrics = vertexMetrics?.get(graphNode.id)

  const node: FlinkOperatorNode = {
    id: internalId,
    nodeType: operatorType,
    operation: graphNode.operator,
    operatorType,
    category,
    parallelism: graphNode.parallelism || 1,
    description: graphNode.description,
    inputs,
    children: [],
    rawData: {
      ...graphNode,
      runtimeMetrics: metrics,
    } as unknown as Record<string, unknown>,
    relation: extractRelation(graphNode.description),

    groupByKeys: extractGroupByKeys(graphNode.description),
    selectExpressions: extractSelectExpressions(graphNode.description),
    whereCondition: extractWhereCondition(graphNode.description),
    aggregateFunctions: extractAggregateFunctions(graphNode.description),

    actualRows: metrics?.metrics?.["write-records"],
  }

  if (isStateful) {
    node.stateInfo = {
      stateType: "ValueState",
      growthPattern: "linear",
      ttlConfigured: false,
    }
  }

  if (category === "join") {
    const leftSpecMatch = graphNode.description.match(/leftInputSpec=\[(\w+)\]/)
    const rightSpecMatch = graphNode.description.match(
      /rightInputSpec=\[(\w+)\]/,
    )
    const joinCondMatch = graphNode.description.match(/where=\[([^\]]+)\]/)

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
      node.lookupInfo = extractLookupInfo(graphNode.description)
    }
  }

  return node
}

function buildTree(
  nodes: FlinkOperatorNode[],
  graphNodes: JobGraphNode[],
  nodeMap: Map<string, string>,
): FlinkOperatorNode {
  const nodeById = new Map<string, FlinkOperatorNode>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const graphNode = graphNodes[i]

    node.inputs = node.inputs.map((input) => ({
      ...input,
      operatorId: nodeMap.get(input.operatorId) || input.operatorId,
    }))

    for (const input of graphNode.inputs || []) {
      const childId = nodeMap.get(input.id)
      if (childId) {
        const childNode = nodeById.get(childId)
        if (childNode) {
          node.children.push(childNode)
          childNode.parentId = node.id
        }
      }
    }
  }

  let root = nodes.find((n) => !n.parentId)

  if (!root && nodes.length > 0) {
    root = nodes[nodes.length - 1]
  }

  if (!root) {
    throw new Error("Could not determine root node")
  }

  return root
}

function countNodes(node: FlinkOperatorNode): number {
  let count = 1
  for (const child of node.children) {
    count += countNodes(child)
  }
  return count
}

function calculateMaxDepth(node: FlinkOperatorNode, currentDepth = 0): number {
  if (node.children.length === 0) {
    return currentDepth
  }
  return Math.max(
    ...node.children.map((child) => calculateMaxDepth(child, currentDepth + 1)),
  )
}

/**
 * Parse a Flink job graph REST response into a {@link NormalizedFlinkPlan}.
 *
 * Extracts operator nodes from `plan.nodes`, enriches them with runtime
 * vertex metrics when available, and resolves input references into a DAG.
 */
export function parseJobGraphPlan(input: string): NormalizedFlinkPlan {
  nodeIdCounter = 0

  let jobGraph: JobGraphResponse

  try {
    jobGraph = JSON.parse(input)
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${e.message}`)
    }
    throw e
  }

  if (!jobGraph.plan?.nodes || jobGraph.plan.nodes.length === 0) {
    throw new Error("No operators found in job graph")
  }

  const vertexMetrics = new Map<string, JobGraphVertex>()
  if (jobGraph.vertices) {
    for (const vertex of jobGraph.vertices) {
      vertexMetrics.set(vertex.id, vertex)
    }
  }

  const nodeMap = new Map<string, string>()
  const nodes = jobGraph.plan.nodes.map((graphNode) =>
    parseJobGraphNode(graphNode, nodeMap, vertexMetrics),
  )
  const root = buildTree(nodes, jobGraph.plan.nodes, nodeMap)

  return {
    root,
    totalNodes: countNodes(root),
    maxDepth: calculateMaxDepth(root),
    rawPlan: input,
    format: "json",
    jobType:
      jobGraph.plan.type?.toUpperCase() === "BATCH" ? "BATCH" : "STREAMING",
  }
}
