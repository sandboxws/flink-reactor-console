/**
 * @module parser
 *
 * Entry point and format dispatcher for Flink execution plan parsing.
 * Auto-detects whether the input is a text plan, JSON execution plan, or
 * job-graph response, then delegates to the appropriate format-specific parser.
 */

import type { FlinkPlanFormat, NormalizedFlinkPlan } from "../types"
import { parseJobGraphPlan } from "./job-graph-parser"
import { parseJsonPlan } from "./json-parser"
import { parseTextPlan } from "./text-parser"

export { parseJobGraphPlan } from "./job-graph-parser"
export { parseJsonPlan } from "./json-parser"
export { parseTextPlan } from "./text-parser"

/**
 * Detect the format of a Flink execution plan from its raw string content.
 *
 * Tries JSON parsing first. Within valid JSON, distinguishes job-graph format
 * (has `jid` + `plan.nodes`) from generic JSON execution plans. Falls back
 * to `"text"` for non-JSON or invalid JSON input.
 *
 * @param input - Raw plan string to classify.
 * @returns The detected {@link FlinkPlanFormat}: `"json"`, `"job-graph"`, or `"text"`.
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
 * Parse a Flink execution plan, auto-detecting format if none is provided.
 *
 * Delegates to {@link parseTextPlan}, {@link parseJsonPlan}, or
 * {@link parseJobGraphPlan} based on the detected (or explicit) format.
 *
 * @param input - Raw plan string to parse.
 * @param format - Optional explicit format; skips auto-detection when provided.
 * @returns A {@link NormalizedFlinkPlan} containing the operator tree and metadata.
 * @throws If the format is unknown or the input cannot be parsed.
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
