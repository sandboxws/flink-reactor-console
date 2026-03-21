import type { FlinkPlanFormat, NormalizedFlinkPlan } from "../types"
import { parseJobGraphPlan } from "./job-graph-parser"
import { parseJsonPlan } from "./json-parser"
import { parseTextPlan } from "./text-parser"

export { parseJobGraphPlan } from "./job-graph-parser"
export { parseJsonPlan } from "./json-parser"
export { parseTextPlan } from "./text-parser"

/**
 * Detect the format of a Flink execution plan
 */
export function detectFormat(input: string): FlinkPlanFormat {
  const trimmed = input.trim()

  // Check for JSON format
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)

      // Job Graph format has specific structure
      if (parsed.jid && parsed.plan?.nodes) {
        return "job-graph"
      }

      // JSON execution plan format
      if (parsed.nodes || (parsed.plan && parsed.plan.nodes)) {
        return "json"
      }

      // Array of nodes
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
        return "json"
      }

      // Default to json if valid JSON
      return "json"
    } catch {
      // Not valid JSON, fall through to text
    }
  }

  // Default to text format
  return "text"
}

/**
 * Parse a Flink execution plan, auto-detecting format
 */
export function parsePlan(
  input: string,
  format?: FlinkPlanFormat,
): NormalizedFlinkPlan {
  const detectedFormat = format || detectFormat(input)

  switch (detectedFormat) {
    case "json":
      return parseJsonPlan(input)
    case "job-graph":
      return parseJobGraphPlan(input)
    case "text":
      return parseTextPlan(input)
    default:
      throw new Error(`Unknown plan format: ${detectedFormat}`)
  }
}
