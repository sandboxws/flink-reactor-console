/**
 * Centralized SQL identifier and literal quoting for Flink SQL emission.
 *
 * Flink SQL identifiers are wrapped in backticks. Embedded backticks in the
 * identifier itself must be doubled (`` `` ``). Failure to escape is a real
 * footgun: a column or table name that legitimately contains a backtick
 * would generate a malformed CREATE/SELECT statement that still parses
 * partially and fails downstream with confusing errors.
 *
 * String literals follow standard SQL: single-quote wrap, double the inner
 * quote. Used for connector option values, comment strings, default values.
 *
 * Contract — pick the right tool for the position:
 *   - `quoteIdentifier`   → SQL identifiers: table / column / catalog names.
 *                           Backtick-wrapped, inner backtick doubled.
 *   - `quoteStringLiteral` → SQL string literals: connector option keys *and*
 *                           values, SET values, metadata FROM keys. In Flink a
 *                           WITH entry `'key' = 'value'` is two string
 *                           literals, not identifiers — both sides are escaped.
 *                           Prefer `sqlOption` / `formatWithClause` so escaping
 *                           can't be forgotten at a call site.
 *   - User SQL *expressions* (Filter `condition`, Join `on`, Map / AddField
 *                           select expressions, watermark expressions) are
 *                           emitted verbatim by design — they are user-authored
 *                           code, not data, and must not be escaped.
 */

/** Wrap an identifier in backticks, escaping any embedded backticks. */
export function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``
}

/**
 * Build a dotted, fully-quoted SQL identifier from its parts.
 *
 *   quoteQualifiedName("cat", "db", "tbl") → `\`cat\`.\`db\`.\`tbl\``
 *
 * Use this instead of `${q(a)}.${q(b)}.${q(c)}` so the dot is uniformly
 * outside the backticks (and so callers don't accidentally introduce
 * spaces or other inconsistencies).
 */
export function quoteQualifiedName(...parts: readonly string[]): string {
  return parts.map(quoteIdentifier).join(".")
}

/** Wrap a string literal in single quotes, escaping embedded single quotes. */
export function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Format a single connector/SET option as an escaped `'key' = 'value'`
 * assignment. Both sides are SQL string literals in Flink, so both are
 * escaped — a value (or user-provided option key) containing a single quote
 * can't break out of the statement.
 */
export function sqlOption(key: string, value: string): string {
  return `${quoteStringLiteral(key)} = ${quoteStringLiteral(value)}`
}

/**
 * Build the body of a `WITH ( … )` clause from option entries: one
 * two-space-indented `'key' = 'value'` per line, comma+newline joined, every
 * key and value escaped via {@link sqlOption}.
 *
 * Pass `{ sort: true }` to emit keys in lexicographic order. Flink reads a
 * WITH clause as a property bag — key order has no runtime meaning — so
 * sorting yields canonical, refactor-stable output. Callers that need a
 * specific human-facing order (e.g. SET statements) build their lines from
 * {@link sqlOption} directly instead.
 */
export function formatWithClause(
  entries: Iterable<readonly [string, string]>,
  opts: { sort?: boolean } = {},
): string {
  const list = [...entries]
  if (opts.sort) list.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return list.map(([key, value]) => `  ${sqlOption(key, value)}`).join(",\n")
}
