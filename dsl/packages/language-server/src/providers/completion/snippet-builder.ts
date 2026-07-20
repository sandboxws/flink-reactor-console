// Snippet construction for completion insertions.
//
// Three jobs:
//   • child-component elements with required props pre-filled as tab stops
//   • connector-prop `name=value` insertions (string/enum vs braced value)
//   • the Flink SQL type catalog, with placeholder tab stops for parameterized
//     and composite forms
//
// Child-element snippets assume the triggering `<` is already in the buffer
// (the dominant JSX tag-completion path), so they begin at the component name.

import { PROP_METADATA, type PropMeta } from "./prop-metadata.generated.js"

/** A prop whose value is written as a quoted string (plain string or enum). */
function isStringy(prop: PropMeta): boolean {
  return prop.enumValues !== undefined || prop.type === "string"
}

/** `topic="$1"` for string/enum props, `bucket={$1}` otherwise. */
function attrPlaceholder(prop: PropMeta, tabStop: number): string {
  return isStringy(prop) ? `"$${tabStop}"` : `{$${tabStop}}`
}

/**
 * Snippet body for inserting a child component after a typed `<`. Required props
 * become ordered tab stops; containers get a `$0` children region, leaves
 * self-close. Dot-notation names (`Route.Branch`) round-trip through the close
 * tag.
 */
export function childElementSnippet(
  component: string,
  isContainer: boolean,
): string {
  const required = (PROP_METADATA[component] ?? []).filter((p) => p.required)
  const attrs = required.map((p, i) => `${p.name}=${attrPlaceholder(p, i + 1)}`)
  const head = [component, ...attrs].join(" ")
  return isContainer ? `${head}>\n\t$0\n</${component}>` : `${head} />`
}

/** Snippet for a connector prop's `name=value` insertion, with a value tab stop. */
export function propAttributeSnippet(prop: PropMeta): string {
  return `${prop.name}=${attrPlaceholder(prop, 1)}`
}

/** One Flink SQL type offered in a schema/column type position. */
export interface FlinkTypeCompletion {
  /** Display label (parameterized forms show their parameters). */
  readonly label: string
  /** Snippet insert text; parameterized/composite forms carry tab stops. */
  readonly insertText: string
  /** Whether `insertText` contains snippet tab stops. */
  readonly isSnippet: boolean
  /** Short category for the completion detail. */
  readonly detail: string
}

// Mirrors the Flink SQL type system in `src/core/types.ts` (the source of
// truth). Primitives insert literally; parameterized and composite types insert
// with placeholder tab stops the author then fills.
const PRIMITIVES = [
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
] as const

const PARAMETERIZED: ReadonlyArray<{ label: string; insertText: string }> = [
  { label: "DECIMAL(p, s)", insertText: "DECIMAL(${1:10}, ${2:2})" },
  { label: "TIMESTAMP(n)", insertText: "TIMESTAMP(${1:3})" },
  { label: "TIMESTAMP_LTZ(n)", insertText: "TIMESTAMP_LTZ(${1:3})" },
  { label: "VARCHAR(n)", insertText: "VARCHAR(${1:255})" },
  { label: "CHAR(n)", insertText: "CHAR(${1:1})" },
  { label: "BINARY(n)", insertText: "BINARY(${1:1})" },
  { label: "VARBINARY(n)", insertText: "VARBINARY(${1:1})" },
]

const COMPOSITE: ReadonlyArray<{ label: string; insertText: string }> = [
  { label: "ARRAY<T>", insertText: "ARRAY<${1:STRING}>" },
  { label: "MAP<K, V>", insertText: "MAP<${1:STRING}, ${2:STRING}>" },
  { label: "ROW<...>", insertText: "ROW<${1:field_name} ${2:STRING}>" },
]

/** The full Flink SQL type catalog for type-position completion. */
export const FLINK_TYPE_COMPLETIONS: readonly FlinkTypeCompletion[] = [
  ...PRIMITIVES.map((t) => ({
    label: t,
    insertText: t,
    isSnippet: false,
    detail: "Flink primitive type",
  })),
  ...PARAMETERIZED.map((t) => ({
    ...t,
    isSnippet: true,
    detail: "Flink parameterized type",
  })),
  ...COMPOSITE.map((t) => ({
    ...t,
    isSnippet: true,
    detail: "Flink composite type",
  })),
]
