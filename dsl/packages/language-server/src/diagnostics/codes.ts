// The category → `FR-{CATEGORY}-{NNN}` code convention — the single,
// cross-editor source of truth shared by the VS Code, IntelliJ, and Neovim
// clients. Codes are derived **purely** from a finding's `category` so the
// same finding reads identically in every editor (design decision: "Codes are
// derived purely from category"). Each category owns a reserved `…-0xx`
// numeric range; today one canonical code is emitted per category and the
// remaining numbers in each range are reserved for future sub-classification.
//
// Two invariants this module guards (tasks 1.5 / 9.3):
//   1. Every emitted code is `FR`-prefixed.
//   2. No emitted code collides with the ts-plugin's in-`tsserver` JSX nesting
//      diagnostic (code `90100`), which is owned there and never duplicated.

import type { ValidationCategory } from "../synth/types.js"

/** The diagnostic `source` stamped on every FlinkReactor diagnostic. */
export const DIAGNOSTIC_SOURCE = "flink-reactor"

/** The ts-plugin's in-`tsserver` JSX-nesting diagnostic code. FlinkReactor LSP
 *  diagnostics must never collide with it. */
export const TS_PLUGIN_NESTING_CODE = 90100

/** One row of the category → code table. */
export interface DiagnosticCodeRow {
  readonly category: ValidationCategory
  /** The stable `FR-{CATEGORY}-` prefix every code in this category begins with. */
  readonly prefix: string
  /** The canonical code emitted for this category today. */
  readonly code: string
  /** Human-readable description of the reserved range (for docs). */
  readonly summary: string
}

/**
 * The authoritative category → `FR-{CATEGORY}-{NNN}` table. Documented in the
 * package README and asserted by the cross-editor parity test so the three
 * clients can never drift.
 */
export const DIAGNOSTIC_CODE_TABLE: readonly DiagnosticCodeRow[] = [
  {
    category: "schema",
    prefix: "FR-SCHEMA-",
    code: "FR-SCHEMA-001",
    summary: "Unknown column reference (with did-you-mean)",
  },
  {
    category: "expression",
    prefix: "FR-EXPR-",
    code: "FR-EXPR-001",
    summary: "Malformed SQL expression in a transform prop",
  },
  {
    category: "connector",
    prefix: "FR-CONN-",
    code: "FR-CONN-001",
    summary: "Missing required/conditional connector property",
  },
  {
    category: "changelog",
    prefix: "FR-CDC-",
    code: "FR-CDC-001",
    summary: "Changelog-mode incompatibility (cross-node source↔sink)",
  },
  {
    category: "structure",
    prefix: "FR-DAG-",
    code: "FR-DAG-001",
    summary: "Structural violation — orphan source, dangling sink, or cycle",
  },
  {
    category: "sql",
    prefix: "FR-SQL-",
    code: "FR-SQL-001",
    summary: "Generated-SQL verification (reserved; not produced here)",
  },
]

/** Fallback code for a finding with no (or an unrecognized) category. */
export const FR_GENERAL_CODE = "FR-GENERAL-001"

const CODE_BY_CATEGORY: ReadonlyMap<string, string> = new Map(
  DIAGNOSTIC_CODE_TABLE.map((row) => [row.category, row.code]),
)

/**
 * Map a validation category to its stable `FR-{CATEGORY}-{NNN}` code. Unknown
 * or absent categories fall back to `FR-GENERAL-001` — never a TypeScript code
 * and never the ts-plugin nesting code.
 */
export function codeForCategory(category: string | undefined): string {
  if (category === undefined) return FR_GENERAL_CODE
  return CODE_BY_CATEGORY.get(category) ?? FR_GENERAL_CODE
}

/** True when `code` is a FlinkReactor-emitted diagnostic code (FR-prefixed and
 *  not the ts-plugin nesting code). The publishing layer asserts this. */
export function isFlinkReactorCode(code: unknown): code is string {
  return (
    typeof code === "string" &&
    code.startsWith("FR-") &&
    code !== String(TS_PLUGIN_NESTING_CODE)
  )
}
