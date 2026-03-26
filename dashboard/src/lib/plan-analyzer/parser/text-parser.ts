/**
 * @module text-parser
 *
 * Parses Flink execution plans in indented text format (the default output of
 * `EXPLAIN PLAN FOR ...`). Supports both the tree-indented format using `+- / :-`
 * prefixes and the staged format (`Stage N : ...` with `content:` / `ship_strategy:` lines).
 * Produces a {@link NormalizedFlinkPlan} with a nested operator tree.
 */

import {
  OPERATOR_CATEGORIES,
  OPERATOR_PATTERNS,
  STATEFUL_OPERATORS,
} from "../constants"
import type {
  ExchangeMode,
  FlinkLookupInfo,
  FlinkOperatorNode,
  FlinkOperatorType,
  NormalizedFlinkPlan,
  ShuffleStrategy,
} from "../types"

/** A single parsed line from the text plan, carrying indentation depth and operator classification. */
interface TextLine {
  indent: number
  content: string
  lineNumber: number
  isOperator: boolean
}

let nodeIdCounter = 0

/** Generate a unique sequential node ID (e.g., `flink-node-1`). */
function generateNodeId(): string {
  return `flink-node-${++nodeIdCounter}`
}

/**
 * Split raw plan text into structured {@link TextLine} entries.
 *
 * Detects whether the input uses the staged format (`Stage N : ...`) and
 * delegates to {@link parseStagedLines} if so. Otherwise parses tree-indented
 * lines, stripping `+- / :-` prefixes and computing indentation depth.
 *
 * @param input - Raw text plan string.
 * @returns Array of parsed lines with indentation, content, and operator flags.
 */
function parseLines(input: string): TextLine[] {
  const lines = input.split("\n")
  const result: TextLine[] = []

  // Detect staged format: "Stage N : Data Source/Operator/Data Sink"
  const isStaged = lines.some((l) => /^\s*Stage\s+\d+\s*:/.test(l))

  if (isStaged) {
    return parseStagedLines(lines)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip empty lines and section headers
    if (line.trim() === "") continue
    if (line.trim().startsWith("==")) continue
    if (
      line.trim() === "Abstract Syntax Tree" ||
      line.trim() === "Optimized Physical Plan" ||
      line.trim() === "Optimized Execution Plan"
    )
      continue

    const match = line.match(/^(\s*)([+:|`-]*)(.*)$/)
    if (match) {
      const spaces = match[1]
      const prefix = match[2]
      const content = match[3].trim()

      if (!content) continue

      const indent = spaces.length + prefix.length
      const isOperator = isOperatorLine(content)

      result.push({
        indent,
        content,
        lineNumber: i + 1,
        isOperator,
      })
    }
  }

  return result
}

/**
 * Parse the staged text format used by Flink's Physical Execution Plan output:
 *   Stage 1 : Data Source
 *     content : Source: KafkaSource(...)
 *     ship_strategy : FORWARD
 */
function parseStagedLines(lines: string[]): TextLine[] {
  const result: TextLine[] = []
  let currentStageIndent = 0
  let currentShipStrategy: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("==")) continue

    // Match "Stage N : Data Source/Operator/Data Sink"
    const stageMatch = line.match(/^(\s*)Stage\s+\d+\s*:\s*(.*)$/)
    if (stageMatch) {
      currentStageIndent = stageMatch[1].length
      currentShipStrategy = undefined
      continue
    }

    // Match "ship_strategy : HASH"
    const shipMatch = trimmed.match(/^ship_strategy\s*:\s*(.+)$/i)
    if (shipMatch) {
      currentShipStrategy = shipMatch[1].trim()
      continue
    }

    // Match "content : Source: KafkaSource(...)"
    const contentMatch = trimmed.match(/^content\s*:\s*(.+)$/i)
    if (contentMatch) {
      let operatorContent = contentMatch[1].trim()
      // Prepend ship_strategy if present so extractShuffleStrategy can find it
      if (currentShipStrategy) {
        operatorContent = `${operatorContent} [ship_strategy=${currentShipStrategy}]`
      }

      result.push({
        indent: currentStageIndent,
        content: operatorContent,
        lineNumber: i + 1,
        isOperator: true,
      })
    }
  }

  return result
}

/** Test whether a line's content represents a Flink operator (matches known patterns or function-call syntax). */
function isOperatorLine(content: string): boolean {
  for (const { pattern } of OPERATOR_PATTERNS) {
    if (pattern.test(content)) {
      return true
    }
  }

  if (content.match(/^\w+\s*\(/)) {
    return true
  }

  return false
}

/** Match operator text against known patterns and return the corresponding {@link FlinkOperatorType}, or `"Unknown"`. */
function parseOperatorType(content: string): FlinkOperatorType {
  for (const { pattern, type } of OPERATOR_PATTERNS) {
    if (pattern.test(content)) {
      return type
    }
  }
  return "Unknown"
}

function extractShuffleStrategy(content: string): ShuffleStrategy {
  // Check for staged-format ship_strategy annotation
  const shipMatch = content.match(/\[ship_strategy=(\w+)\]/)
  if (shipMatch) {
    const strategy = shipMatch[1].toUpperCase()
    if (strategy.includes("HASH")) return "HASH"
    if (strategy.includes("BROADCAST")) return "BROADCAST"
    if (strategy.includes("FORWARD")) return "FORWARD"
    if (strategy.includes("REBALANCE")) return "REBALANCE"
    if (strategy.includes("RESCALE")) return "RESCALE"
    if (strategy.includes("GLOBAL")) return "GLOBAL"
    if (strategy.includes("CUSTOM")) return "CUSTOM"
  }

  const distributionMatch = content.match(/distribution=\[(\w+)/)
  if (distributionMatch) {
    const dist = distributionMatch[1].toUpperCase()
    if (dist.includes("HASH")) return "HASH"
    if (dist.includes("BROADCAST")) return "BROADCAST"
    if (dist.includes("FORWARD")) return "FORWARD"
    if (dist.includes("REBALANCE")) return "REBALANCE"
    if (dist.includes("GLOBAL")) return "GLOBAL"
  }
  return "FORWARD"
}

function parseExchangeMode(content: string): ExchangeMode {
  const modeMatch =
    content.match(/exchange_mode=\[(\w+)\]/i) ||
    content.match(/exchangeMode=\[(\w+)\]/i)
  if (modeMatch) {
    const normalized = modeMatch[1].toLowerCase()
    if (normalized.includes("pipelined_bounded")) return "pipelined_bounded"
    if (normalized.includes("pipelined")) return "pipelined"
    if (normalized.includes("batch")) return "batch"
  }
  if (content.toLowerCase().includes("batch")) return "batch"
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

function extractGroupByKeys(content: string): string[] | undefined {
  const inner = extractBracketContent(content, "groupBy")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractSelectExpressions(content: string): string[] | undefined {
  const inner = extractBracketContent(content, "select")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractWhereCondition(content: string): string | undefined {
  return extractBracketContent(content, "where")
}

function extractAggregateFunctions(content: string): string[] | undefined {
  const inner =
    extractBracketContent(content, "agg") ||
    extractBracketContent(content, "aggregates")
  if (inner) {
    return splitTopLevelCommas(inner)
  }
  return undefined
}

function extractRelation(content: string): string | undefined {
  const tableMatch =
    content.match(/table=\[\[([^\]]+)\]\]/i) ||
    content.match(/table=\[([^\]]+)\]/i)
  if (tableMatch?.[1]) {
    const parts = tableMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return parts[parts.length - 1] || tableMatch[1].trim()
  }

  const topicMatch = content.match(/topic=\[([^\]]+)\]/i)
  if (topicMatch?.[1]) {
    return topicMatch[1].trim()
  }

  const pathMatch = content.match(/path=\[([^\]]+)\]/i)
  if (pathMatch?.[1]) {
    const p = pathMatch[1].trim()
    const file = p.split("/").filter(Boolean).pop()
    return file || p
  }

  return undefined
}

function extractLookupInfo(content: string): FlinkLookupInfo | undefined {
  if (!/lookupjoin/i.test(content)) {
    return undefined
  }

  const tableMatch = content.match(/table=\[([^\]]+)\]/i)
  const asyncMatch = content.match(/async=\[(true|false)\]/i)
  const asyncCapacityMatch = content.match(/asyncCapacity=\[(\d+)\]/i)
  const asyncTimeoutMatch = content.match(/asyncTimeout=\[(\d+)\]/i)
  const cacheMatch = content.match(/cache=\[([^\]]+)\]/i)
  const cacheSizeMatch = content.match(/size=(\d+)/i)
  const cacheTtlMatch = content.match(/ttl=(\d+)/i)
  const retryMatch = content.match(/retry=\[(true|false)\]/i)
  const retryAttemptsMatch = content.match(/retryAttempts=\[(\d+)\]/i)

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

function parseOperatorLine(content: string): Partial<FlinkOperatorNode> {
  // Extract and strip ship_strategy annotation from staged format
  const shipAnnotation = content.match(/\s*\[ship_strategy=(\w+)\]$/)
  const shipStrategy: ShuffleStrategy = shipAnnotation
    ? extractShuffleStrategy(content)
    : "FORWARD"
  const cleanContent = shipAnnotation
    ? content.replace(/\s*\[ship_strategy=\w+\]$/, "")
    : content

  const operatorType = parseOperatorType(cleanContent)
  const category = OPERATOR_CATEGORIES[operatorType] || "unknown"
  const isStateful = STATEFUL_OPERATORS.has(operatorType)

  const node: Partial<FlinkOperatorNode> = {
    id: generateNodeId(),
    nodeType: operatorType,
    operation: operatorType,
    operatorType,
    category,
    parallelism: 1,
    description: cleanContent,
    inputs: [
      {
        operatorId: "",
        shipStrategy,
        exchangeMode: parseExchangeMode(cleanContent),
      },
    ],
    children: [],
    rawData: { originalText: cleanContent },

    groupByKeys: extractGroupByKeys(cleanContent),
    selectExpressions: extractSelectExpressions(cleanContent),
    whereCondition: extractWhereCondition(cleanContent),
    aggregateFunctions: extractAggregateFunctions(cleanContent),
    relation: extractRelation(cleanContent),
  }

  if (isStateful) {
    node.stateInfo = {
      stateType: "ValueState",
      growthPattern: "linear",
      ttlConfigured: false,
    }
  }

  if (category === "join") {
    const leftSpecMatch = cleanContent.match(/leftInputSpec=\[(\w+)\]/)
    const rightSpecMatch = cleanContent.match(/rightInputSpec=\[(\w+)\]/)
    const joinCondMatch = cleanContent.match(/where=\[([^\]]+)\]/)

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
      node.lookupInfo = extractLookupInfo(cleanContent)
    }
  }

  if (operatorType === "Exchange") {
    const exchangeStrategy = extractShuffleStrategy(cleanContent)
    node.inputs = [
      {
        operatorId: "",
        shipStrategy: exchangeStrategy,
        exchangeMode: parseExchangeMode(cleanContent),
      },
    ]
  }

  return node
}

function buildTree(lines: TextLine[]): FlinkOperatorNode {
  if (lines.length === 0) {
    throw new Error("No operator nodes found in plan")
  }

  const operatorLines = lines.filter((l) => l.isOperator)
  if (operatorLines.length === 0) {
    throw new Error("No operator nodes found in plan")
  }

  const stack: { node: Partial<FlinkOperatorNode>; indent: number }[] = []
  let root: FlinkOperatorNode | null = null

  for (const line of operatorLines) {
    const node = parseOperatorLine(line.content)

    while (stack.length > 0 && stack[stack.length - 1].indent >= line.indent) {
      stack.pop()
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node
      node.parentId = parent.id
      parent.children!.push(node as FlinkOperatorNode)

      // The child's own inputs[0] carries its ship strategy from the plan text
      // Add a reference from parent → child with the child's ship strategy
      if (!parent.inputs) parent.inputs = []
      parent.inputs.push({
        operatorId: node.id!,
        shipStrategy: node.inputs?.[0]?.shipStrategy || "FORWARD",
        exchangeMode: node.inputs?.[0]?.exchangeMode || "undefined",
      })
    } else {
      root = node as FlinkOperatorNode
    }

    stack.push({ node, indent: line.indent })
  }

  if (!root) {
    throw new Error("Could not build plan tree")
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

function detectJobType(input: string): "STREAMING" | "BATCH" {
  if (
    input.toLowerCase().includes("batch") ||
    input.toLowerCase().includes("bounded")
  ) {
    return "BATCH"
  }
  return "STREAMING"
}

export function parseTextPlan(input: string): NormalizedFlinkPlan {
  nodeIdCounter = 0

  const lines = parseLines(input)
  const root = buildTree(lines)

  return {
    root,
    totalNodes: countNodes(root),
    maxDepth: calculateMaxDepth(root),
    rawPlan: input,
    format: "text",
    jobType: detectJobType(input),
  }
}
