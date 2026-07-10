// ── Avro → Flink SQL type mapping ───────────────────────────────────
//
// Pure mapping over a parsed Avro schema (JSON). Lives in `src/codegen/`
// (not `src/cli/`) so the browser bundle, LSP, and console can reach it
// without pulling in the CLI's `fetch`/registry code. The Kafka Schema
// Registry introspector parses a subject's schema string and hands the
// resulting JSON tree here.
//
// Avro logical `timestamp-*` types map to plain `TIMESTAMP(n)` (a good
// starting point the developer can retype to `TIMESTAMP_LTZ` if the
// column is a true instant). Unknown/unsupported shapes fall back to
// STRING rather than throwing, so a single odd field never blocks
// generating the rest of the schema.

import type { IntrospectedColumn } from "@/codegen/schema-introspect.js"

export interface AvroMapping {
  /** Flink SQL type literal, e.g. `"BIGINT"`, `"ROW<a INT>"`. */
  readonly flink: string
  /** Whether the Avro type is a `["null", …]` union (nullable). */
  readonly nullable: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mapAvroPrimitive(name: string): string {
  switch (name) {
    case "long":
      return "BIGINT"
    case "int":
      return "INT"
    case "string":
      return "STRING"
    case "double":
      return "DOUBLE"
    case "float":
      return "FLOAT"
    case "boolean":
      return "BOOLEAN"
    case "bytes":
      return "BYTES"
    // `null` is only meaningful inside a union; a bare `null` field is
    // degenerate — fall back to STRING.
    default:
      return "STRING"
  }
}

function mapAvroLogical(
  logicalType: string,
  obj: Record<string, unknown>,
): string | undefined {
  switch (logicalType) {
    case "timestamp-millis":
    case "local-timestamp-millis":
      return "TIMESTAMP(3)"
    case "timestamp-micros":
    case "local-timestamp-micros":
      return "TIMESTAMP(6)"
    case "date":
      return "DATE"
    case "time-millis":
    case "time-micros":
      return "TIME"
    case "decimal": {
      const precision = typeof obj.precision === "number" ? obj.precision : 38
      const scale = typeof obj.scale === "number" ? obj.scale : 0
      return `DECIMAL(${precision}, ${scale})`
    }
    case "uuid":
      return "STRING"
    default:
      // Unknown logical type — let the caller fall back to the base type.
      return undefined
  }
}

/**
 * Map a single Avro type node (a primitive string, a union array, or a
 * complex/logical object) to a Flink SQL type + nullability flag.
 */
export function mapAvroTypeToFlink(type: unknown): AvroMapping {
  // Primitive string form: "long", "int", "string", …
  if (typeof type === "string") {
    return { flink: mapAvroPrimitive(type), nullable: type === "null" }
  }

  // Union form: ["null", X], [X, "null"], or a multi-type union.
  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== "null")
    const nullable = nonNull.length !== type.length
    if (nonNull.length === 1) {
      const inner = mapAvroTypeToFlink(nonNull[0])
      return { flink: inner.flink, nullable: nullable || inner.nullable }
    }
    // Empty (all-null) or genuine multi-type union → STRING fallback.
    return { flink: "STRING", nullable: nullable || nonNull.length === 0 }
  }

  // Complex / logical object form.
  if (isRecord(type)) {
    if (typeof type.logicalType === "string") {
      const mapped = mapAvroLogical(type.logicalType, type)
      if (mapped) return { flink: mapped, nullable: false }
    }
    const baseType = type.type
    if (typeof baseType === "string") {
      switch (baseType) {
        case "record":
          return { flink: avroRecordToRow(type), nullable: false }
        case "array":
          return {
            flink: `ARRAY<${mapAvroTypeToFlink(type.items).flink}>`,
            nullable: false,
          }
        case "map":
          return {
            flink: `MAP<STRING, ${mapAvroTypeToFlink(type.values).flink}>`,
            nullable: false,
          }
        case "enum":
          return { flink: "STRING", nullable: false }
        case "fixed":
          return { flink: "BYTES", nullable: false }
        default:
          return { flink: mapAvroPrimitive(baseType), nullable: false }
      }
    }
    // Nested type expressed as a further object/array (e.g. `type: {…}`).
    if (baseType !== undefined) return mapAvroTypeToFlink(baseType)
  }

  return { flink: "STRING", nullable: false }
}

/** Render an Avro `record` node as a Flink `ROW<name TYPE, …>` literal. */
function avroRecordToRow(record: Record<string, unknown>): string {
  const fields = Array.isArray(record.fields) ? record.fields : []
  const parts = fields
    .map((field) => {
      if (!isRecord(field)) return undefined
      const name = typeof field.name === "string" ? field.name : "field"
      return `${name} ${mapAvroTypeToFlink(field.type).flink}`
    })
    .filter((part): part is string => part !== undefined)
  return `ROW<${parts.join(", ")}>`
}

/**
 * Convert a top-level Avro record schema into ordered introspected
 * columns (fields in declaration order — deterministic). Throws if the
 * top-level schema is not a record, since there are no named columns to
 * emit in that case.
 */
export function avroRecordToColumns(
  recordSchema: unknown,
): IntrospectedColumn[] {
  if (!isRecord(recordSchema) || recordSchema.type !== "record") {
    throw new Error(
      "Expected a top-level Avro `record` schema, but got " +
        `${describeAvro(recordSchema)}. Declare this source's schema manually.`,
    )
  }
  const fields = Array.isArray(recordSchema.fields) ? recordSchema.fields : []
  return fields
    .map((field): IntrospectedColumn | undefined => {
      if (!isRecord(field) || typeof field.name !== "string") return undefined
      return {
        name: field.name,
        type: mapAvroTypeToFlink(field.type).flink,
        constraints: [],
      }
    })
    .filter((col): col is IntrospectedColumn => col !== undefined)
}

function describeAvro(schema: unknown): string {
  if (typeof schema === "string") return `primitive '${schema}'`
  if (Array.isArray(schema)) return "a union"
  if (isRecord(schema) && typeof schema.type === "string") {
    return `type '${schema.type}'`
  }
  return "an unrecognized schema"
}
