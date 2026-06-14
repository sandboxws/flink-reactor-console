import { describe, expect, it } from "vitest"
import { resetNodeIdCounter } from "@/core/jsx-runtime.js"
import { synth } from "@/testing/synth.js"

/**
 * Structural invariants every emitted pipeline must satisfy, independent of
 * the (opaque) snapshot. Snapshots catch *changes* but silently bless a
 * statement that was malformed from day one; this asserts the class of bugs
 * that matters most — unbalanced quoting/brackets and JS values coerced into
 * SQL. Also the permanent guard for connector-option escaping.
 */
function assertWellFormedSql(sql: string, label: string): void {
  // Drop `--` line comments so banner prose can't skew the balance counts.
  const noComments = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")

  // String literals must be balanced (every literal is an even quote count,
  // including doubled inner quotes).
  expect(
    (noComments.match(/'/g) ?? []).length % 2,
    `${label}: unbalanced single quotes`,
  ).toBe(0)

  // Blank out string-literal *contents* before bracket/backtick checks so a
  // paren or backtick inside a literal can't skew the counts.
  const noLiterals = noComments.replace(/'(?:[^']|'')*'/g, "''")
  expect(
    (noLiterals.match(/`/g) ?? []).length % 2,
    `${label}: unbalanced backticks`,
  ).toBe(0)
  let depth = 0
  let minDepth = 0
  for (const ch of noLiterals) {
    if (ch === "(") depth++
    else if (ch === ")") depth--
    if (depth < minDepth) minDepth = depth
  }
  expect(depth, `${label}: unbalanced parentheses`).toBe(0)
  expect(minDepth, `${label}: ')' before matching '('`).toBe(0)

  // No JS values coerced into SQL.
  for (const artifact of ["undefined", "[object Object]", "NaN"]) {
    expect(noComments.includes(artifact), `${label}: leaked ${artifact}`).toBe(
      false,
    )
  }

  const trimmed = noComments.trim()
  expect(trimmed.length, `${label}: empty SQL`).toBeGreaterThan(0)
  expect(trimmed.endsWith(";"), `${label}: not ;-terminated`).toBe(true)
}

const EXAMPLES = [
  "01-simple-source-sink",
  "02-filter-project",
  "03-group-aggregate",
  "04-tumble-window",
  "05-hop-window",
  "06-interval-join",
  "07-lookup-join",
  "08-multi-stream-join",
  "11-dedup-window",
  "12-session-window",
  "13-simple-etl",
  "14-ohlcv-window",
  "15-cep-fraud-detection",
  "16-temporal-join",
  "18-broadcast-join",
  "19-union-aggregate",
  "20-realtime-dashboard",
  "21-branching-multi-sink",
  "22-enrichment-archive",
  "23-batch-etl",
  "24-lambda-architecture",
  "25-batch-reporting",
  "26-cdc-sync",
  "27-ml-feature-pipeline",
  "28-branching-iot",
  // Sandbox-derived examples
  "30-flatmap-unnest",
  "31-top-n-ranking",
  "32-union-streams",
  "33-rename-fields",
  "34-drop-fields",
  "35-cast-types",
  "36-coalesce-defaults",
  "37-add-computed-field",
  "38-dedup-aggregate",
]

// Spec: ORD-1, ORD-2, ORD-5 (docs/contributors/specs/statement-ordering.md)
describe("Example SQL Snapshots", () => {
  for (const id of EXAMPLES) {
    it(id, async () => {
      resetNodeIdCounter()
      const mod = await import(`../../examples/${id}/after.tsx`)
      const { sql } = synth(mod.default)
      assertWellFormedSql(sql, id)
      expect(sql).toMatchSnapshot()
    })
  }
})
