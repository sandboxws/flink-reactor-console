// A best-effort scanner over an embedded Flink SQL fragment. It does NOT build a
// SQL AST (a non-goal — see design): it classifies lexical runs (keywords,
// functions, types, operators, numbers, strings, comments) against the known
// vocabulary and leaves everything else — identifiers, whitespace, punctuation —
// unclassified. Offsets are relative to the fragment's first character; the
// semantic-tokens provider rebases them onto absolute document positions.
//
// "Best-effort" is load-bearing (task 5.4 / spec "malformed or mid-edit SQL"):
// the author is usually mid-keystroke, so an unterminated `'string`, an open
// `/* comment`, or a half-typed `SELECT` must still yield the tokens we *can*
// recognize and never throw. Unterminated literals simply run to end-of-input.

import { classifyWord, type SqlTokenCategory } from "./vocabulary.js"

/** One classified lexical run, positioned relative to the fragment start. */
export interface SqlToken {
  /** 0-based character offset from the start of the fragment. */
  readonly offset: number
  readonly length: number
  readonly category: SqlTokenCategory
}

const isDigit = (c: string): boolean => c >= "0" && c <= "9"
// SQL identifiers: a leading letter/underscore, then word chars. (Back-quoted
// identifiers from the DSL codegen never reach here — fragments are the verbatim
// author text, which is unquoted.)
const isIdentStart = (c: string): boolean =>
  (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_"
const isIdentPart = (c: string): boolean => isIdentStart(c) || isDigit(c)

/**
 * Tokenize `sql` into the classified runs the highlighter colors. Identifiers
 * not in the vocabulary, whitespace, commas, and parentheses produce no token
 * (they render in the host string color), keeping the token stream sparse.
 */
export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  const n = sql.length
  let i = 0

  while (i < n) {
    const c = sql[i]

    // ── Line comment `-- … <eol>` ──────────────────────────────────────
    if (c === "-" && sql[i + 1] === "-") {
      const start = i
      i += 2
      while (i < n && sql[i] !== "\n" && sql[i] !== "\r") i++
      tokens.push({ offset: start, length: i - start, category: "comment" })
      continue
    }

    // ── Block comment `/* … */` (unterminated → to end) ────────────────
    if (c === "/" && sql[i + 1] === "*") {
      const start = i
      i += 2
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i = i < n ? i + 2 : n // consume the closing `*/` when present
      tokens.push({ offset: start, length: i - start, category: "comment" })
      continue
    }

    // ── Single-quoted string `'…'` with `''` escape (unterminated → end) ─
    if (c === "'") {
      const start = i
      i++
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2 // doubled quote is an escaped quote, stay in the string
            continue
          }
          i++ // closing quote
          break
        }
        i++
      }
      tokens.push({ offset: start, length: i - start, category: "string" })
      continue
    }

    // ── Numeric literal `123`, `12.5`, `.5` ────────────────────────────
    if (isDigit(c) || (c === "." && isDigit(sql[i + 1] ?? ""))) {
      const start = i
      while (i < n && isDigit(sql[i])) i++
      if (sql[i] === ".") {
        i++
        while (i < n && isDigit(sql[i])) i++
      }
      tokens.push({ offset: start, length: i - start, category: "number" })
      continue
    }

    // ── Identifier / keyword / function / type ─────────────────────────
    if (isIdentStart(c)) {
      const start = i
      i++
      while (i < n && isIdentPart(sql[i])) i++
      const word = sql.slice(start, i)
      const category = classifyWord(word)
      // Unknown identifiers (columns, aliases, table names, newer-version
      // builtins) produce no token — they stay plain text (task 1.3).
      if (category) tokens.push({ offset: start, length: i - start, category })
      continue
    }

    // ── Operators (longest match first) ────────────────────────────────
    const op = matchOperator(sql, i)
    if (op > 0) {
      tokens.push({ offset: i, length: op, category: "operator" })
      i += op
      continue
    }

    // Whitespace, commas, parentheses, brackets — uncolored.
    i++
  }

  return tokens
}

// Multi-char operators are tried before their single-char prefixes so `<=`/`<>`
// are not split into `<` `=`. `||` is SQL string concatenation.
const MULTI_CHAR_OPS = ["<=", ">=", "<>", "!=", "||"]
const SINGLE_CHAR_OPS = new Set(["=", "<", ">", "+", "-", "*", "/", "%"])

/** Length of the operator starting at `i`, or 0 if none. */
function matchOperator(sql: string, i: number): number {
  for (const op of MULTI_CHAR_OPS) {
    if (sql.startsWith(op, i)) return op.length
  }
  return SINGLE_CHAR_OPS.has(sql[i]) ? 1 : 0
}
