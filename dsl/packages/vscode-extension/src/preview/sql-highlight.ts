// Decorative Flink SQL tokenizer for the SQL-preview webview — pure, DOM-free,
// so it unit-tests in plain Node (the sibling of `blocks.ts`). The webview wraps
// each `SqlToken` carrying a non-null category in a colored `<span>`, leaving the
// rest as plain text. It composes *over* the byte-offset fragment overlay
// `blocks.ts#segment` produces — token spans nest inside the `.frag` spans, never
// alter offsets, and never become click targets (only `.frag` carries
// `data-origin`). See the `blocks.ts` header: the overlay is "independent of any
// decorative tokenization".
//
// WHY a local vocabulary instead of importing one: the canonical sets live in
// `@flink-reactor/language-server` (`src/sql/vocabulary.ts`), but that package
// only exports its full Node server bundle — un-importable from a browser IIFE
// webview. So, exactly like the TextMate grammar
// (`syntaxes/flinkreactor-sql.injection.json`) which mirrors the same lists by
// hand "a static grammar cannot import TS", we mirror them here. The expression
// sets below are guarded against drift by a parity test
// (`__tests__/preview/sql-highlight.test.ts`) that imports the canonical source
// and asserts set-equality.

/** Token categories, 1:1 with the canonical `SqlTokenCategory` and the `.tok-*`
 *  CSS classes the webview renders. `null` = unclassified (plain text). */
export type SqlTokenCategory =
  | "keyword"
  | "function"
  | "type"
  | "operator"
  | "number"
  | "string"
  | "comment"

/** One lexeme: its exact source text and the category it colors as (or `null`,
 *  rendered as a bare text node). Concatenating every token's `text` in order
 *  reproduces the input verbatim — the tokenizer never drops or rewrites bytes. */
export interface SqlToken {
  readonly text: string
  readonly category: SqlTokenCategory | null
}

// ── Vocabulary (mirror of language-server/src/sql/vocabulary.ts) ─────────────
// Keep these THREE sets byte-for-byte in step with the canonical module; the
// parity test fails if they drift. `PREVIEW_DDL_KEYWORDS` below is the only
// preview-specific addition and is intentionally NOT mirrored upstream.

/** Reserved expression/clause keywords. Mirror of canonical `FLINK_KEYWORDS`. */
export const FLINK_KEYWORDS: ReadonlySet<string> = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "LIKE",
  "BETWEEN",
  "EXISTS",
  "DISTINCT",
  "ALL",
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "OFFSET",
  "FETCH",
  "FIRST",
  "NEXT",
  "ROW",
  "ROWS",
  "ONLY",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "WITH",
  "VALUES",
  "TABLE",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "USING",
  "NATURAL",
  "LATERAL",
  "UNNEST",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "INTERVAL",
  "OVER",
  "PARTITION",
  "WINDOW",
  "RANGE",
  "PRECEDING",
  "FOLLOWING",
  "CURRENT",
  "UNBOUNDED",
  "TO",
  "AT",
  "TIME",
  "ZONE",
  "TRUE",
  "FALSE",
  "UNKNOWN",
  "ESCAPE",
  "SYMMETRIC",
  "ASYMMETRIC",
  "FOR",
  "SYSTEM_TIME",
  "OF",
  "DESCRIPTOR",
  "DEFAULT",
  "PARTITIONED",
  "TEMPORARY",
  "IF",
])

/** Built-in / Flink-specific functions + windowing TVFs. Mirror of canonical
 *  `FLINK_FUNCTIONS`. */
export const FLINK_FUNCTIONS: ReadonlySet<string> = new Set([
  // Conversion / conditional
  "CAST",
  "TRY_CAST",
  "COALESCE",
  "NULLIF",
  "IFNULL",
  "GREATEST",
  "LEAST",
  // String
  "UPPER",
  "LOWER",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "SUBSTRING",
  "SUBSTR",
  "CONCAT",
  "CONCAT_WS",
  "REPLACE",
  "REGEXP_REPLACE",
  "REGEXP_EXTRACT",
  "CHAR_LENGTH",
  "CHARACTER_LENGTH",
  "LENGTH",
  "POSITION",
  "OVERLAY",
  "INITCAP",
  "REVERSE",
  "SPLIT_INDEX",
  "STR_TO_MAP",
  "FROM_BASE64",
  "TO_BASE64",
  "MD5",
  "SHA1",
  "SHA256",
  // Numeric
  "ABS",
  "CEIL",
  "CEILING",
  "FLOOR",
  "ROUND",
  "TRUNCATE",
  "POWER",
  "SQRT",
  "EXP",
  "LN",
  "LOG",
  "LOG2",
  "LOG10",
  "SIN",
  "COS",
  "TAN",
  "MOD",
  "RAND",
  "RAND_INTEGER",
  "SIGN",
  "PI",
  "E",
  // Aggregate / window-agg
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "STDDEV_POP",
  "STDDEV_SAMP",
  "VAR_POP",
  "VAR_SAMP",
  "COLLECT",
  "LISTAGG",
  "FIRST_VALUE",
  "LAST_VALUE",
  "LEAD",
  "LAG",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "NTILE",
  "CUME_DIST",
  "PERCENT_RANK",
  // Temporal
  "NOW",
  "CURRENT_TIMESTAMP",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "LOCALTIME",
  "LOCALTIMESTAMP",
  "EXTRACT",
  "YEAR",
  "QUARTER",
  "MONTH",
  "WEEK",
  "DAYOFYEAR",
  "DAYOFMONTH",
  "DAYOFWEEK",
  "HOUR",
  "MINUTE",
  "SECOND",
  "DATE_FORMAT",
  "TO_TIMESTAMP",
  "TO_TIMESTAMP_LTZ",
  "TO_DATE",
  "UNIX_TIMESTAMP",
  "FROM_UNIXTIME",
  "TIMESTAMPADD",
  "TIMESTAMPDIFF",
  "CONVERT_TZ",
  // Flink streaming-specific
  "PROCTIME",
  "PROCTIME_MATERIALIZE",
  "CURRENT_WATERMARK",
  "TUMBLE",
  "HOP",
  "SESSION",
  "TUMBLE_START",
  "TUMBLE_END",
  "TUMBLE_ROWTIME",
  "HOP_START",
  "HOP_END",
  "SESSION_START",
  "SESSION_END",
  // Collection
  "ARRAY_CONTAINS",
  "CARDINALITY",
  "ELEMENT",
  "MAP_KEYS",
  "MAP_VALUES",
])

/** Flink SQL type names. Mirror of canonical `FLINK_TYPES`. */
export const FLINK_TYPES: ReadonlySet<string> = new Set([
  "BOOLEAN",
  "TINYINT",
  "SMALLINT",
  "INT",
  "INTEGER",
  "BIGINT",
  "FLOAT",
  "DOUBLE",
  "DECIMAL",
  "DEC",
  "NUMERIC",
  "DATE",
  "TIMESTAMP",
  "TIMESTAMP_LTZ",
  "CHAR",
  "VARCHAR",
  "STRING",
  "BINARY",
  "VARBINARY",
  "BYTES",
  "ARRAY",
  "MAP",
  "MULTISET",
  "RAW",
])

/**
 * Statement-level DDL/DML keywords the *preview* shows but the embedded-prop
 * highlighter never sees (it only ever scopes expression fragments). Without
 * these the most prominent words in the preview — `CREATE CATALOG`,
 * `CREATE TABLE`, `SET`, `INSERT INTO`, `PRIMARY KEY … NOT ENFORCED` — render
 * uncolored. Preview-only, so excluded from the upstream-parity test.
 *
 * NOTE(curate): this list shapes what reads as a "keyword" in the preview. The
 * entries below cover the statements FlinkReactor synthesizes today (CREATE
 * CATALOG/DATABASE/TABLE/VIEW + SET + INSERT/STATEMENT SET). If you add DSL
 * components that synthesize other DDL (ALTER/DROP/USE MODULES, computed/metadata
 * columns, DISTRIBUTED BY …), extend this set — coloring is vocabulary-driven, so
 * a new word stays plain until it's listed here. Keep it disjoint from
 * FLINK_FUNCTIONS/FLINK_TYPES so classification stays unambiguous.
 */
export const PREVIEW_DDL_KEYWORDS: ReadonlySet<string> = new Set([
  "CREATE",
  "REPLACE",
  "ALTER",
  "DROP",
  "CATALOG",
  "DATABASE",
  "SCHEMA",
  "VIEW",
  "INSERT",
  "INTO",
  "OVERWRITE",
  "SET",
  "RESET",
  "USE",
  "MODULES",
  "FUNCTION",
  "PRIMARY",
  "KEY",
  "CONSTRAINT",
  "ENFORCED",
  "WATERMARK",
  "COMMENT",
  "COMPUTED",
  "METADATA",
  "VIRTUAL",
  "STORED",
  "GENERATED",
  "DISTRIBUTED",
  "BUCKETS",
  "OPTIONS",
  "INCLUDING",
  "EXCLUDING",
  "EXECUTE",
  "STATEMENT",
  "BEGIN",
  "ADD",
  "MODIFY",
  "RENAME",
  "COLUMN",
  "LANGUAGE",
])

/**
 * Classify an identifier-shaped word, or `null` when it is outside the known
 * vocabulary (a column/table name, alias, or a function/type from a newer Flink
 * version) — those stay plain text, never colored as an error.
 *
 * Precedence is **type → function → keyword (expression ∪ DDL)**, matching the
 * canonical `classifyWord`: `DECIMAL` colors as a type even though it takes
 * parentheses like a function, and `CAST`/`UPPER` color as functions, not
 * keywords. Matching is case-insensitive (Flink keywords are).
 */
export function classifyWord(word: string): SqlTokenCategory | null {
  const w = word.toUpperCase()
  if (FLINK_TYPES.has(w)) return "type"
  if (FLINK_FUNCTIONS.has(w)) return "function"
  if (FLINK_KEYWORDS.has(w) || PREVIEW_DDL_KEYWORDS.has(w)) return "keyword"
  return null
}

// ── Lexer ────────────────────────────────────────────────────────────────────

const isDigit = (c: string): boolean => c >= "0" && c <= "9"
/** SQL identifier start: a letter or `_` (Flink also allows `$`). */
const isWordStart = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$"
/** SQL identifier continuation: a word-start char or a digit. */
const isWordPart = (c: string): boolean => isWordStart(c) || isDigit(c)
/** The operator alphabet (mirrors the grammar's operator class). Greedily run
 *  together so `<=`, `>=`, `<>`, `!=`, `||` color as one operator token. */
const isOperatorChar = (c: string): boolean => "<>=!+-*/%|".includes(c)

/**
 * Lex Flink SQL into ordered tokens for decorative coloring. A scan, not a
 * parser — it recognizes lexeme *shapes*, not grammar, which is all coloring
 * needs and keeps it resilient to partial/invalid SQL.
 *
 * Order matters: the longest/most-specific lexemes are tried first so their
 * interiors are never re-tokenized —
 *   1. `-- line` and `/​* block *​/` comments,
 *   2. `'string literals'` (with the `''` escape — a doubled quote is one
 *      embedded quote, not a close-then-reopen),
 *   3. `` `quoted identifiers` `` — Flink quotes every generated identifier in
 *      backticks; their interior is NEVER classified, so `` `table` `` reads as
 *      an identifier, not the TABLE keyword,
 *   4. numbers, then identifier words (classified via {@link classifyWord}),
 *   5. operator runs.
 * Everything else (whitespace, `(),;.` punctuation) coalesces into plain runs so
 * the DOM node count stays low for the webview's lazy-rendering path.
 */
export function tokenize(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  const n = sql.length
  let i = 0
  // Pending run of unclassified text (whitespace + punctuation), flushed as one
  // plain token before any classified token — fewer DOM nodes than per-char.
  let plain = ""
  const flushPlain = (): void => {
    if (plain) {
      tokens.push({ text: plain, category: null })
      plain = ""
    }
  }
  const push = (text: string, category: SqlTokenCategory | null): void => {
    flushPlain()
    if (text) tokens.push({ text, category })
  }

  while (i < n) {
    const c = sql[i]

    // 1a. Line comment: `--` to end of line (newline excluded).
    if (c === "-" && sql[i + 1] === "-") {
      let j = i + 2
      while (j < n && sql[j] !== "\n") j++
      push(sql.slice(i, j), "comment")
      i = j
      continue
    }
    // 1b. Block comment: `/* … */` (unterminated runs to EOF).
    if (c === "/" && sql[i + 1] === "*") {
      let j = i + 2
      while (j < n && !(sql[j] === "*" && sql[j + 1] === "/")) j++
      j = Math.min(n, j + 2)
      push(sql.slice(i, j), "comment")
      i = j
      continue
    }
    // 2. Single-quoted string, with the SQL `''` escape.
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2
            continue
          }
          j++
          break
        }
        j++
      }
      push(sql.slice(i, j), "string")
      i = j
      continue
    }
    // 3. Backtick-quoted identifier — interior left unclassified (plain).
    if (c === "`") {
      let j = i + 1
      while (j < n && sql[j] !== "`") j++
      j = Math.min(n, j + 1)
      push(sql.slice(i, j), null)
      i = j
      continue
    }
    // 4a. Number (integer or decimal).
    if (isDigit(c)) {
      let j = i + 1
      while (j < n && (isDigit(sql[j]) || sql[j] === ".")) j++
      push(sql.slice(i, j), "number")
      i = j
      continue
    }
    // 4b. Identifier word → classify against the vocabulary.
    if (isWordStart(c)) {
      let j = i + 1
      while (j < n && isWordPart(sql[j])) j++
      const word = sql.slice(i, j)
      push(word, classifyWord(word))
      i = j
      continue
    }
    // 5. Operator run.
    if (isOperatorChar(c)) {
      let j = i + 1
      while (j < n && isOperatorChar(sql[j])) j++
      push(sql.slice(i, j), "operator")
      i = j
      continue
    }
    // Otherwise: accumulate into the plain run (whitespace, `(),;.` …).
    plain += c
    i++
  }
  flushPlain()
  return tokens
}
