// The DSL's single source of truth for *which* component props carry SQL
// expressions or column references — `EXPRESSION_PROPS` — reshaped for editor
// features. Shared by hover (column-reference classification) and column
// completion (where to offer columns + how to insert them), so both stay in
// lockstep with the validator. A prop added to the DSL table is honored here
// automatically.
//
// Each table entry is a path with a terminal modifier declaring the value shape:
//   `prop`     a string SQL expression           → insert back-quoted
//   `prop.*`   a Record whose *values* are exprs  → insert back-quoted
//   `prop[]`   a string[] of column names         → insert bare (codegen quotes)
//   `prop{}`   a Record whose *keys* are columns  → insert bare (codegen quotes)
//   `prop#`    a string holding one column name   → insert bare (codegen quotes)
//   segments join with `.` for nested shapes (e.g. `rules.expression.*`).

import { EXPRESSION_PROPS } from "@flink-reactor/dsl/browser"

/** One step from a prop's value down toward a column slot. */
export type Descent =
  | { readonly kind: "key"; readonly name: string } // into a named property's value
  | { readonly kind: "anyValue" } // into any record value (`.*`)
  | { readonly kind: "element" } // into an array element (`[]`)

/** A column slot a component declares, parsed from one EXPRESSION_PROPS path. */
export interface ColumnSlot {
  /** The JSX attribute (prop) name that owns this slot. */
  readonly prop: string
  /** Descents from the prop value down to the slot's container. */
  readonly descents: readonly Descent[]
  /** `value` → the slot is a string value/element; `key` → a record key. */
  readonly slot: "value" | "key"
  /** `backtick` → insert a back-quoted SQL identifier; `bare` → the raw name. */
  readonly quote: "backtick" | "bare"
}

function parseSegment(seg: string): {
  base: string
  suffix: "" | "[]" | "{}" | "#"
} {
  if (seg.endsWith("[]")) return { base: seg.slice(0, -2), suffix: "[]" }
  if (seg.endsWith("{}")) return { base: seg.slice(0, -2), suffix: "{}" }
  if (seg.endsWith("#")) return { base: seg.slice(0, -1), suffix: "#" }
  return { base: seg, suffix: "" }
}

/** Parse one EXPRESSION_PROPS path into a column-slot descriptor. */
function parsePath(path: string): ColumnSlot {
  const segments = path.split(".")
  let prop = ""
  const descents: Descent[] = []
  let slot: "value" | "key" = "value"
  let quote: "backtick" | "bare" = "backtick"
  segments.forEach((seg, i) => {
    const { base, suffix } = parseSegment(seg)
    if (i === 0) prop = base
    else if (base === "*") descents.push({ kind: "anyValue" })
    else descents.push({ kind: "key", name: base })
    if (suffix === "[]") {
      descents.push({ kind: "element" })
      quote = "bare"
    } else if (suffix === "{}") {
      slot = "key"
      quote = "bare"
    } else if (suffix === "#") {
      quote = "bare"
    }
  })
  return { prop, descents, slot, quote }
}

/** The column slots component `tag` declares (empty when it has none). */
export function columnSlotsFor(tag: string): ColumnSlot[] {
  return (EXPRESSION_PROPS[tag] ?? []).map(parsePath)
}

/** Does a declared descent chain accept a cursor's actual descent chain? */
export function descentsMatch(
  cursor: readonly Descent[],
  declared: readonly Descent[],
): boolean {
  if (cursor.length !== declared.length) return false
  return declared.every((d, i) => {
    const c = cursor[i]
    if (d.kind === "anyValue") return c.kind === "key"
    if (d.kind === "key") return c.kind === "key" && c.name === d.name
    return c.kind === "element"
  })
}

const basePropOf = (path: string): string =>
  parseSegment(path.split(".")[0]).base

/**
 * Is `propName` on component `tag` a SQL-expression / column-reference prop —
 * i.e. may an identifier inside its value be a column reference? Matches the
 * base (first-segment) name of any declared path, so it honors the new value
 * shapes (`groupBy[]`, `rules.notNull[]`, …) as well as the scalar/object ones.
 *
 * `tag` is the JSX tag text including dot-notation (`Query.Where`), exactly how
 * `EXPRESSION_PROPS` is keyed.
 */
export function isExpressionProp(tag: string, propName: string): boolean {
  const paths = EXPRESSION_PROPS[tag]
  if (!paths) return false
  return paths.some((p) => basePropOf(p) === propName)
}

/** Every component tag that declares at least one column-referencing prop. */
export function hasExpressionProps(tag: string): boolean {
  return EXPRESSION_PROPS[tag] !== undefined
}
