/**
 * @module flink-sql-completion
 *
 * CodeMirror 6 autocompletion for the Flink SQL editors (SQL Explorer + catalog
 * Explore). Offers Flink SQL keywords and built-in functions, including the
 * Flink 2.3 changelog process-table-functions FROM_CHANGELOG / TO_CHANGELOG
 * (FLIP-564). Those two are gated on the cluster's `FROM_TO_CHANGELOG`
 * capability so they only appear when connected to a 2.3+ cluster.
 *
 * The Flink SQL Gateway surface in this app is a passthrough proxy with no
 * server-side function catalog, so this is a curated static vocabulary —
 * the same approach as the DSL sandbox's completion engine
 * (`components/sandbox/completions`).
 */
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  completionKeymap,
} from "@codemirror/autocomplete"
import { type Extension, Prec } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { useClusterStore } from "@/stores/cluster-store"

/** A Flink SQL built-in function offered in autocomplete. */
type FlinkFunction = {
  name: string
  /** Short signature shown as the completion detail. */
  signature: string
  /** One-line description shown in the completion info panel. */
  doc: string
  /** Optional cluster capability required (see server `capabilities.go`). */
  capability?: string
}

const FUNCTIONS: FlinkFunction[] = [
  // ── Flink 2.3 changelog PTFs (FLIP-564) — gated on FROM_TO_CHANGELOG ──
  {
    name: "FROM_CHANGELOG",
    signature: "FROM_CHANGELOG(TABLE t [, op_col])",
    doc: "Flink 2.3 (FLIP-564): interpret an append-only table as a changelog stream (+I/-U/+U/-D), producing a retracting/upserting result.",
    capability: "FROM_TO_CHANGELOG",
  },
  {
    name: "TO_CHANGELOG",
    signature: "TO_CHANGELOG(TABLE t)",
    doc: "Flink 2.3 (FLIP-564): materialize a changelog stream into an append-only table where each row carries its changelog op as a column.",
    capability: "FROM_TO_CHANGELOG",
  },
  // ── Aggregate ──
  {
    name: "COUNT",
    signature: "COUNT([DISTINCT] expr)",
    doc: "Number of rows / non-null values.",
  },
  {
    name: "SUM",
    signature: "SUM([DISTINCT] expr)",
    doc: "Sum of a numeric column.",
  },
  {
    name: "AVG",
    signature: "AVG([DISTINCT] expr)",
    doc: "Average of a numeric column.",
  },
  { name: "MIN", signature: "MIN(expr)", doc: "Minimum value." },
  { name: "MAX", signature: "MAX(expr)", doc: "Maximum value." },
  {
    name: "LISTAGG",
    signature: "LISTAGG(expr [, sep])",
    doc: "Concatenate values into a delimited string.",
  },
  // ── Windowing TVFs ──
  {
    name: "TUMBLE",
    signature: "TUMBLE(TABLE t, DESCRIPTOR(time), size)",
    doc: "Tumbling (fixed, non-overlapping) window table-valued function.",
  },
  {
    name: "HOP",
    signature: "HOP(TABLE t, DESCRIPTOR(time), slide, size)",
    doc: "Hopping (sliding, overlapping) window table-valued function.",
  },
  {
    name: "CUMULATE",
    signature: "CUMULATE(TABLE t, DESCRIPTOR(time), step, size)",
    doc: "Cumulating window table-valued function.",
  },
  {
    name: "SESSION",
    signature: "SESSION(TABLE t, DESCRIPTOR(time), gap)",
    doc: "Session window table-valued function.",
  },
  // ── String ──
  { name: "UPPER", signature: "UPPER(s)", doc: "Uppercase a string." },
  { name: "LOWER", signature: "LOWER(s)", doc: "Lowercase a string." },
  {
    name: "CONCAT",
    signature: "CONCAT(s1, s2, ...)",
    doc: "Concatenate strings.",
  },
  {
    name: "CONCAT_WS",
    signature: "CONCAT_WS(sep, s1, s2, ...)",
    doc: "Concatenate strings with a separator.",
  },
  {
    name: "SUBSTRING",
    signature: "SUBSTRING(s FROM i [FOR n])",
    doc: "Extract a substring.",
  },
  {
    name: "REPLACE",
    signature: "REPLACE(s, search, replacement)",
    doc: "Replace all occurrences of a substring.",
  },
  {
    name: "REGEXP_REPLACE",
    signature: "REGEXP_REPLACE(s, regex, replacement)",
    doc: "Replace substrings matching a regular expression.",
  },
  {
    name: "COALESCE",
    signature: "COALESCE(v1, v2, ...)",
    doc: "Return the first non-null argument.",
  },
  {
    name: "IFNULL",
    signature: "IFNULL(v, ifNull)",
    doc: "Return v, or ifNull when v is NULL.",
  },
  // ── Temporal ──
  {
    name: "CURRENT_TIMESTAMP",
    signature: "CURRENT_TIMESTAMP",
    doc: "Current timestamp, evaluated per record.",
  },
  { name: "NOW", signature: "NOW()", doc: "Current timestamp." },
  {
    name: "DATE_FORMAT",
    signature: "DATE_FORMAT(ts, format)",
    doc: "Format a timestamp/date into a string.",
  },
  {
    name: "TIMESTAMPADD",
    signature: "TIMESTAMPADD(unit, interval, ts)",
    doc: "Add an interval to a timestamp.",
  },
  {
    name: "TIMESTAMPDIFF",
    signature: "TIMESTAMPDIFF(unit, ts1, ts2)",
    doc: "Difference between two timestamps in the given unit.",
  },
  {
    name: "TO_TIMESTAMP_LTZ",
    signature: "TO_TIMESTAMP_LTZ(numeric, precision)",
    doc: "Convert an epoch value to TIMESTAMP_LTZ.",
  },
  // ── Conversion / JSON ──
  { name: "CAST", signature: "CAST(expr AS type)", doc: "Type cast." },
  {
    name: "TRY_CAST",
    signature: "TRY_CAST(expr AS type)",
    doc: "Cast, returning NULL instead of failing on invalid input.",
  },
  {
    name: "JSON_VALUE",
    signature: "JSON_VALUE(json, path)",
    doc: "Extract a scalar value from a JSON string using a path.",
  },
  {
    name: "JSON_QUERY",
    signature: "JSON_QUERY(json, path)",
    doc: "Extract an object or array from a JSON string using a path.",
  },
  {
    name: "JSON_OBJECT",
    signature: "JSON_OBJECT(KEY k VALUE v, ...)",
    doc: "Build a JSON object string from key/value pairs.",
  },
]

/** Common Flink SQL keywords / clause starters. */
const KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "INNER JOIN",
  "CROSS JOIN",
  "ON",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS NULL",
  "IS NOT NULL",
  "INSERT INTO",
  "VALUES",
  "CREATE TABLE",
  "CREATE VIEW",
  "CREATE MATERIALIZED TABLE",
  "ALTER MATERIALIZED TABLE",
  "WITH",
  "DISTINCT",
  "UNION ALL",
  "OVER",
  "PARTITION BY",
  "WINDOW",
  "DESCRIPTOR",
  "LATERAL",
  "UNNEST",
  "EXPLAIN",
  "DESCRIBE",
]

const KEYWORD_OPTIONS: Completion[] = KEYWORDS.map((kw) => ({
  label: kw,
  type: "keyword",
}))

/**
 * Completion source: keywords + built-in functions, with the 2.3 changelog
 * PTFs filtered in only when the connected cluster advertises the capability.
 * Capabilities are read live from the store (not captured at editor-creation
 * time) so the vocabulary tracks cluster changes without rebuilding the editor.
 */
function flinkSqlCompletions(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[\w]+/)
  if (!word || (word.from === word.to && !ctx.explicit)) return null

  const caps = useClusterStore.getState().overview?.capabilities ?? []

  const fnOptions: Completion[] = FUNCTIONS.filter(
    (fn) => !fn.capability || caps.includes(fn.capability),
  ).map((fn) => ({
    label: fn.name,
    type: "function",
    detail: fn.signature,
    info: fn.doc,
    apply: `${fn.name}(`,
    // Nudge the 2.3 PTFs slightly above the alphabetical run so they're
    // discoverable when a user starts typing "FROM"/"TO".
    boost: fn.capability ? 1 : 0,
  }))

  return {
    from: word.from,
    options: [...fnOptions, ...KEYWORD_OPTIONS],
    validFor: /^[\w]*$/,
  }
}

/**
 * CodeMirror extension enabling Flink SQL autocompletion. Add it alongside the
 * `@codemirror/lang-sql` language extension in an editor's extension list. The
 * completion keymap is given high precedence so Enter/Tab accept a suggestion
 * when the popup is open (without stealing those keys otherwise).
 */
export function flinkSqlAutocomplete(): Extension {
  return [
    autocompletion({ override: [flinkSqlCompletions] }),
    Prec.high(keymap.of(completionKeymap)),
  ]
}
