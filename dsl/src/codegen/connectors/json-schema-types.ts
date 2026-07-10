// ── JSON Schema → Flink SQL type mapping ────────────────────────────
//
// Pure mapping over a parsed JSON Schema document. Lives in
// `src/codegen/` (not `src/cli/`) so the browser bundle, LSP, and
// console can reach it without the CLI's registry code. The Kafka Schema
// Registry introspector parses a `JSON`-type subject and hands the
// resulting document here.
//
// JSON Schema carries no width/precision, so numeric types map to their
// widest Flink counterparts (`integer→BIGINT`, `number→DOUBLE`).
// Nullability (`["string","null"]` / `required`) is not encoded in Flink
// `Field` type strings, so it is observed for resolution but not emitted.
// Unknown shapes fall back to STRING.

import type { IntrospectedColumn } from "@/codegen/schema-introspect.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Resolve a property's effective type, unwrapping `["string","null"]`. */
function effectiveType(prop: Record<string, unknown>): string | undefined {
  const t = prop.type
  if (typeof t === "string") return t
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== "null")
    return typeof nonNull[0] === "string" ? nonNull[0] : undefined
  }
  return undefined
}

/** Map a single JSON Schema property node to a Flink SQL type literal. */
export function mapJsonSchemaTypeToFlink(prop: unknown): string {
  if (!isRecord(prop)) return "STRING"

  switch (effectiveType(prop)) {
    case "integer":
      return "BIGINT"
    case "number":
      return "DOUBLE"
    case "boolean":
      return "BOOLEAN"
    case "string":
      switch (prop.format) {
        case "date-time":
          return "TIMESTAMP(3)"
        case "date":
          return "DATE"
        case "time":
          return "TIME"
        default:
          return "STRING"
      }
    case "object":
      return jsonObjectToRow(prop)
    case "array":
      return `ARRAY<${mapJsonSchemaTypeToFlink(prop.items)}>`
    default:
      return "STRING"
  }
}

/** Render a JSON Schema `object` node as a Flink `ROW<name TYPE, …>`. */
function jsonObjectToRow(prop: Record<string, unknown>): string {
  const properties = isRecord(prop.properties) ? prop.properties : {}
  const parts = Object.entries(properties).map(
    ([name, sub]) => `${name} ${mapJsonSchemaTypeToFlink(sub)}`,
  )
  // A property-less object has no expressible row shape → STRING.
  return parts.length > 0 ? `ROW<${parts.join(", ")}>` : "STRING"
}

/**
 * Convert a top-level JSON Schema object into ordered introspected
 * columns (properties in declaration order — deterministic). Throws if
 * the top-level schema is not an object with `properties`.
 */
export function jsonSchemaToColumns(schema: unknown): IntrospectedColumn[] {
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    throw new Error(
      "Expected a top-level JSON Schema object with `properties`. " +
        "Declare this source's schema manually.",
    )
  }
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: mapJsonSchemaTypeToFlink(prop),
    constraints: [],
  }))
}
