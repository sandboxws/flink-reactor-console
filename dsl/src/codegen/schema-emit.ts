// ── Schema module emitter ───────────────────────────────────────────
//
// Turns introspected columns into a self-contained `schemas/<name>.ts`
// module string (`export const <Pascal>Schema = Schema({ … })`) that uses
// only the public DSL surface (`Schema`, `Field.*`). Lives in
// `src/codegen/` so the LSP/console can reuse it and it stays
// snapshot-testable without any I/O.
//
// Output is deterministic: columns are emitted in the order given, and no
// hashing / Set iteration reaches the string.

import type { IntrospectedColumn } from "@/codegen/schema-introspect.js"

export interface EmitSchemaOptions {
  /** Primary-key column names → `primaryKey: { columns: [...] }`. */
  readonly primaryKey?: readonly string[]
  /** Watermark declaration → `watermark: { column, expression }`. */
  readonly watermark?: { readonly column: string; readonly expression: string }
  /** Import specifier for `Schema`/`Field`. Default: `@flink-reactor/dsl`. */
  readonly importSpecifier?: string
}

const DEFAULT_IMPORT = "@flink-reactor/dsl"

/** Flink scalar types with a zero-arg `Field.<T>()` builder. */
const NO_ARG_SCALARS: ReadonlySet<string> = new Set([
  "BOOLEAN",
  "TINYINT",
  "SMALLINT",
  "INT",
  "BIGINT",
  "FLOAT",
  "DOUBLE",
  "STRING",
  "DATE",
  "TIME",
  "BYTES",
])

// `TIMESTAMP_LTZ` precedes `TIMESTAMP` so the longer name wins the match.
const PARAMETERIZED =
  /^(DECIMAL|TIMESTAMP_LTZ|TIMESTAMP|VARCHAR|CHAR|BINARY|VARBINARY)\((.+)\)$/

/**
 * Render a Flink SQL type string as the source text that reproduces it in
 * a `Schema({ fields })` block.
 *
 * - zero-arg scalars → `Field.BIGINT()`
 * - parameterized    → `Field.TIMESTAMP(3)`, `Field.DECIMAL(38, 18)`
 * - composite / unknown (`ROW<…>`, `ARRAY<…>`, `MAP<…>`) → a quoted string
 *   literal. That's always valid because a `Field.*()` builder just
 *   returns its own type string, so `{ x: 'ROW<a INT>' }` and a builder
 *   call are interchangeable — and it avoids reconstructing a recursive
 *   `Field.*` call tree for nested types.
 */
export function flinkTypeToFieldCall(type: string): string {
  if (NO_ARG_SCALARS.has(type)) return `Field.${type}()`
  const match = PARAMETERIZED.exec(type)
  if (match) return `Field.${match[1]}(${match[2]})`
  return singleQuote(type)
}

/** Build a complete `schemas/<name>.ts` module string. */
export function emitSchemaModule(
  name: string,
  columns: readonly IntrospectedColumn[],
  opts: EmitSchemaOptions = {},
): string {
  const importSpecifier = opts.importSpecifier ?? DEFAULT_IMPORT
  const pascal = toPascalCase(name)

  const fieldLines = columns
    .map(
      (col) => `    ${emitKey(col.name)}: ${flinkTypeToFieldCall(col.type)},`,
    )
    .join("\n")

  let body = `  fields: {\n${fieldLines}\n  },`

  if (opts.primaryKey && opts.primaryKey.length > 0) {
    const cols = opts.primaryKey.map(singleQuote).join(", ")
    body += `\n  primaryKey: { columns: [${cols}] },`
  }

  if (opts.watermark) {
    // The watermark expression is SQL (often contains single quotes, e.g.
    // INTERVAL '5' SECOND) — JSON.stringify yields a safe double-quoted
    // literal, matching the hand-written schema style.
    body += `\n  watermark: { column: ${singleQuote(opts.watermark.column)}, expression: ${JSON.stringify(opts.watermark.expression)} },`
  }

  return `import { Schema, Field } from '${importSpecifier}';\n\nexport const ${pascal}Schema = Schema({\n${body}\n});\n`
}

// ── Local helpers ───────────────────────────────────────────────────

/** Emit a bare object key when it's a valid JS identifier, else quote it. */
function emitKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : singleQuote(name)
}

function singleQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

/** `order-events` / `order_events` → `OrderEvents`. */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}
