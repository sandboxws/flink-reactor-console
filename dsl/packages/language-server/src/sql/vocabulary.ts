// The known Flink SQL token vocabulary (Flink 1.20–2.3), the single source of
// truth for *classifying* an embedded-SQL word into a token category. The LSP
// semantic-tokens layer consumes `classifyWord` directly; the VS Code TextMate
// grammar (`syntaxes/flinkreactor-sql.injection.json`) mirrors these same lists
// by hand (a static grammar cannot import TS — see the design's rejected
// "import EXPRESSION_PROPS into the grammar" alternative), so the two layers
// agree on what is a keyword/function/type even though they tokenize separately.
//
// Matching is case-insensitive (Flink SQL keywords are): every lookup uppercases
// first. An identifier that is in *none* of these sets is left unclassified
// (`null`) — it is plain text, never colored as an error (task 1.3 / spec
// "unknown identifiers are treated as plain"), so the vocabulary degrades
// gracefully as Flink adds functions/types in future versions.

/** The token categories embedded SQL is classified into, shared by both layers.
 *  These map 1:1 to the LSP standard semantic-token *types* the server emits and
 *  to the SQL TextMate *scopes* the grammar emits (see `LEGEND`/the grammar). */
export type SqlTokenCategory =
  | "keyword"
  | "function"
  | "type"
  | "operator"
  | "number"
  | "string"
  | "comment"

/**
 * Reserved SQL keywords (clause/structural words). `CAST`/`UPPER`/aggregate
 * names live in {@link FLINK_FUNCTIONS}, type names in {@link FLINK_TYPES}; this
 * set is kept disjoint from those so classification is unambiguous.
 */
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

/**
 * Built-in / Flink-specific functions and windowing TVFs. Includes the
 * function-style keywords the spec calls out as functions (`CAST`, `UPPER`) and
 * the streaming constructs (`TUMBLE`/`HOP`/`SESSION`, `PROCTIME`,
 * `CURRENT_WATERMARK`). Recognized regardless of whether a `(` follows, so a
 * half-typed `CURRENT_WATERMA` still colors once completed.
 */
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
  // Changelog process table functions (Flink 2.3+, FLIP-564)
  "FROM_CHANGELOG",
  "TO_CHANGELOG",
])

/**
 * Flink SQL type names. Parameterized types (`DECIMAL(10,2)`, `TIMESTAMP(3)`,
 * `TIMESTAMP_LTZ`, `VARCHAR(n)`) are classified by their *name*, so a `(` after
 * the name does not reclassify them as a function — this is why classification
 * is vocabulary-driven, not the naive "identifier-then-paren ⇒ function".
 */
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
 * Classify an identifier-shaped word into its SQL token category, or `null` when
 * it is not part of the known vocabulary (a column/table name, alias, or a
 * function/type from a newer Flink version) — those stay plain text.
 *
 * Precedence is **type → function → keyword**: a name that a future edit might
 * place in two sets resolves deterministically, and the spec's discriminating
 * case is honored — `DECIMAL` colors as a type even though it takes parentheses
 * like a function, and `CAST`/`UPPER` color as functions rather than keywords.
 */
export function classifyWord(word: string): SqlTokenCategory | null {
  const w = word.toUpperCase()
  if (FLINK_TYPES.has(w)) return "type"
  if (FLINK_FUNCTIONS.has(w)) return "function"
  if (FLINK_KEYWORDS.has(w)) return "keyword"
  return null
}
