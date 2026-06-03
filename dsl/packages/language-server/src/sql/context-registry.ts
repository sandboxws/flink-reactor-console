// The single source of truth for *which* `.tsx` props/components carry embedded
// Flink SQL — the cross-editor successor to the IntelliJ plugin's Kotlin
// `EXPRESSION_PROPS` mirror (design: "Single source-of-truth SQL-context
// registry"). Both highlighting layers agree on this set: the LSP semantic-
// tokens provider consumes it directly (via `sqlSlotsFor`/the constants below)
// to find ranges; the static TextMate grammar mirrors the same component/prop
// shapes by hand. Adding a SQL prop to the DSL's `EXPRESSION_PROPS` extends the
// semantic layer here automatically — only the grammar needs a manual echo.
//
// The set is `EXPRESSION_PROPS` filtered to its *verbatim-SQL* shapes — the
// `prop` and `prop.*` paths whose values are SQL expressions — dropping the
// `[]`/`{}`/`#` shapes that hold bare column names (a lone identifier is not
// worth tokenizing). To that it adds the two SQL contexts `EXPRESSION_PROPS`
// does not model: `RawSQL`'s `sql` body and a `Schema`'s watermark expression.

import { type ColumnSlot, columnSlotsFor } from "../expression-props.js"

/** The kind of SQL context a fragment came from. Surfaced as an FR-specific
 *  semantic-token *modifier* so a theme could (optionally) distinguish, say, a
 *  join `on` from a projection — while the base token type stays standard. */
export type SqlContextKind =
  | "clause-expression" // Filter/Query.Where/Query.Having/Qualify condition, Validate rule
  | "projection" // Map/Aggregate `select`, Query.Select `columns`
  | "on-condition" // Join/TemporalJoin/IntervalJoin/LookupJoin `on`
  | "rawsql-body" // RawSQL `sql`
  | "watermark" // Schema watermark expression

/** All context kinds, in legend order — the index of each is its modifier bit
 *  in the emitted semantic tokens (see `sql-semantic-tokens.ts`). */
export const SQL_CONTEXT_KINDS: readonly SqlContextKind[] = [
  "clause-expression",
  "projection",
  "on-condition",
  "rawsql-body",
  "watermark",
]

// ── Non-EXPRESSION_PROPS contexts ────────────────────────────────────────

/** `<RawSQL sql="…">` — the SQL body is the `sql` JSX string prop. */
export const RAWSQL_TAG = "RawSQL"
export const RAWSQL_SQL_PROP = "sql"

/** `const S = Schema({ watermark: { column, expression: "…" } })` — the
 *  watermark *expression* is SQL. `Schema(...)` is a plain call bound to a
 *  variable, not JSX, so it never appears in the `nodeId → Range` source map;
 *  the finder walks these call expressions directly (mirroring how go-to-
 *  definition resolves schemas over the raw AST — see `definition/binding.ts`). */
export const SCHEMA_CALLEE = "Schema"
export const WATERMARK_KEY = "watermark"
export const WATERMARK_EXPRESSION_KEY = "expression"

// ── JSX expression/clause/projection contexts (from EXPRESSION_PROPS) ─────

/**
 * The verbatim-SQL column slots a JSX component `tag` declares — the
 * `EXPRESSION_PROPS` paths whose leaf values are SQL expressions
 * (`condition`, `select.*`, `on`, `rules.expression.*`, …), excluding the
 * bare-column-name shapes. Empty for any tag with no SQL props.
 *
 * Reuses the column-completion path parser so this registry and that feature
 * read `EXPRESSION_PROPS` through one code path and cannot drift.
 */
export function sqlSlotsFor(tag: string): ColumnSlot[] {
  return columnSlotsFor(tag).filter(
    (slot) => slot.quote === "backtick" && slot.slot === "value",
  )
}

/**
 * Classify a JSX SQL slot into its context kind from the owning prop name:
 * `on` → join condition, `select`/`columns` → projection, everything else
 * (`condition`, `rules`) → a clause/boolean expression.
 */
export function kindForJsxSlot(prop: string): SqlContextKind {
  if (prop === "on") return "on-condition"
  if (prop === "select" || prop === "columns") return "projection"
  return "clause-expression"
}
