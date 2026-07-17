import { createElement } from "@/core/jsx-runtime.js"
import type { BaseComponentProps, ConstructNode } from "@/core/types.js"

// ── Changelog process table functions (Flink 2.3+, FLIP-564) ─────────

/**
 * A Flink changelog operation — the canonical RowKind name used by the
 * `FROM_CHANGELOG` / `TO_CHANGELOG` `op_mapping` argument.
 */
export type ChangelogOperation =
  | "INSERT"
  | "UPDATE_BEFORE"
  | "UPDATE_AFTER"
  | "DELETE"

export interface FromChangelogProps extends BaseComponentProps {
  /** Append-only upstream carrying a per-row operation-code column. */
  readonly input: ConstructNode
  /**
   * Column holding the per-row operation code → PTF `op => DESCRIPTOR(col)`.
   * Defaults to `op` when omitted (the PTF default).
   */
  readonly opColumn?: string
  /**
   * Maps each raw operation code in the source to a Flink changelog operation
   * → PTF `op_mapping => MAP[...]`. Keys are the raw values found in the data
   * (e.g. Debezium `c`/`u`/`d`); values are Flink operations. Multiple raw
   * codes may share one operation by comma-joining the key, e.g.
   * `{ "c,r": "INSERT", "u": "UPDATE_AFTER", "d": "DELETE" }`. When omitted,
   * Flink's built-in operation names are expected in the column.
   */
  readonly opMapping?: Record<string, ChangelogOperation>
  /** PTF `error_handling` for null/unknown codes (default `FAIL`). */
  readonly errorHandling?: "FAIL" | "SKIP"
  /** Optional `PARTITION BY` key columns on the input table argument. */
  readonly partitionBy?: readonly string[]
  readonly children?: ConstructNode | ConstructNode[]
}

export interface ToChangelogProps extends BaseComponentProps {
  /** Dynamic (changelog) upstream to flatten into an append-only stream. */
  readonly input: ConstructNode
  /** Output operation-code column name → PTF `op => DESCRIPTOR(col)`. */
  readonly opColumn?: string
  /**
   * Maps each Flink changelog operation to the raw code emitted on the output
   * → PTF `op_mapping => MAP[...]`. Keys are Flink operations, values are your
   * custom codes, e.g. `{ INSERT: "I", UPDATE_AFTER: "U", DELETE: "D" }`.
   */
  readonly opMapping?: Partial<Record<ChangelogOperation, string>>
  /** PTF `produces_full_deletes` (default `true`). */
  readonly producesFullDeletes?: boolean
  /** Optional `PARTITION BY` key columns on the input table argument. */
  readonly partitionBy?: readonly string[]
  readonly children?: ConstructNode | ConstructNode[]
}

/**
 * FromChangelog: interpret an append-only stream's operation column as a
 * changelog, producing a dynamic (updating) table (Flink 2.3+, FLIP-564).
 *
 * Synthesizes to `SELECT * FROM FROM_CHANGELOG(input => TABLE (<upstream>),
 * op => DESCRIPTOR(<opColumn>), op_mapping => MAP[...])`.
 *
 * ```tsx
 * <FromChangelog
 *   input={rawCdc}
 *   opColumn="op"
 *   opMapping={{ 'c,r': 'INSERT', u: 'UPDATE_AFTER', d: 'DELETE' }}
 * />
 * ```
 */
export function FromChangelog(props: FromChangelogProps): ConstructNode {
  if (!props.input) {
    throw new Error("FromChangelog requires an input")
  }

  const { children, input, ...rest } = props
  const childArray =
    children == null ? [] : Array.isArray(children) ? children : [children]

  return createElement(
    "FromChangelog",
    { ...rest, input: input.id },
    input,
    ...childArray,
  )
}

/**
 * ToChangelog: flatten a dynamic (changelog) table back into an append-only
 * stream, materializing the changelog operation into a column (Flink 2.3+,
 * FLIP-564).
 *
 * Synthesizes to `SELECT * FROM TO_CHANGELOG(input => TABLE (<upstream>), …)`.
 */
export function ToChangelog(props: ToChangelogProps): ConstructNode {
  if (!props.input) {
    throw new Error("ToChangelog requires an input")
  }

  const { children, input, ...rest } = props
  const childArray =
    children == null ? [] : Array.isArray(children) ? children : [children]

  return createElement(
    "ToChangelog",
    { ...rest, input: input.id },
    input,
    ...childArray,
  )
}
