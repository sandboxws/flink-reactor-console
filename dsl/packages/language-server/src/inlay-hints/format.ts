// Fact formatters for inlay hints (schema-inlay-hints, Tier-3 feature 10).
//
// Pure label/tooltip composition — no LSP types, no synthesis state — so each
// formatter snapshot-tests in isolation. A part is one independently toggleable
// piece of a node's hint (`5 cols`, `append`, `p=4`, `+window_start,
// +window_end`, `→ 6 cols`); the provider assembles the enabled parts into one
// LSP `InlayHint` whose label parts carry these tooltips, so hover-expansion
// needs no separate request.

import type { InlayHintSchemaMode } from "../config.js"
import type { DecodedParallelism } from "../synth/types.js"
import type { Column } from "./facts.js"

/** One renderable piece of a node's hint. `tooltip` is Markdown. */
export interface HintPart {
  readonly label: string
  readonly tooltip?: string
}

/** Widest a `compact` inline column list may render before falling back to a
 *  count with an ellipsis — keeps hints scannable on wide schemas. */
const COMPACT_MAX_WIDTH = 40

/**
 * The schema fact: `off` omits it, `count` renders `N cols`, `compact` renders
 * an inline `[a, b, c]` up to {@link COMPACT_MAX_WIDTH} and falls back to
 * `N cols …` beyond it. The full `column | TYPE` schema always rides in the
 * tooltip (hover-expansion), regardless of mode.
 */
export function formatSchemaPart(
  schema: readonly Column[],
  mode: InlayHintSchemaMode,
): HintPart | undefined {
  if (mode === "off" || schema.length === 0) return undefined
  const tooltip = schemaTooltip(schema)
  if (mode === "compact") {
    const inline = `[${schema.map((c) => c.name).join(", ")}]`
    if (inline.length <= COMPACT_MAX_WIDTH) return { label: inline, tooltip }
    return { label: `${countLabel(schema.length)} …`, tooltip }
  }
  return { label: countLabel(schema.length), tooltip }
}

/** The changelog-mode badge: the DSL's `append-only` renders as the compact
 *  `append`; `retract`/`upsert` pass through. */
export function formatChangelogPart(mode: string): HintPart {
  const badge = mode === "append-only" ? "append" : mode
  return {
    label: badge,
    tooltip: `Changelog mode \`${mode}\` — the stream this node emits ${describeMode(mode)}.`,
  }
}

/** The effective-parallelism label (`p=4`), with the resolving cascade level
 *  (Pipeline prop > env override > config > default) in the tooltip only, to
 *  keep the inline label terse. */
export function formatParallelismPart(
  parallelism: DecodedParallelism,
): HintPart {
  return {
    label: `p=${parallelism.value}`,
    tooltip: `Effective parallelism \`${parallelism.value}\` — resolved from ${describeLevel(parallelism.level)}.`,
  }
}

/** The window annotation: the injected time columns (`+window_start,
 *  +window_end`). `undefined` when none were found in the downstream schema. */
export function formatWindowPart(
  columns: readonly Column[],
): HintPart | undefined {
  if (columns.length === 0) return undefined
  return {
    label: columns.map((c) => `+${c.name}`).join(", "),
    tooltip:
      "Windowing injects these time columns into the downstream schema:\n\n" +
      schemaTooltip(columns),
  }
}

/** The join annotation: the merged (deduplicated) resulting column count. */
export function formatJoinPart(count: number): HintPart {
  return {
    label: `→ ${countLabel(count)}`,
    tooltip: `The join's merged (deduplicated) output schema has ${countLabel(count)}.`,
  }
}

// ── helpers ─────────────────────────────────────────────────────────

function countLabel(n: number): string {
  return n === 1 ? "1 col" : `${n} cols`
}

/** The full schema as `column | TYPE` Markdown rows — the hover-expansion
 *  payload every schema-bearing part carries. */
function schemaTooltip(schema: readonly Column[]): string {
  const rows = schema.map((c) => `| \`${c.name}\` | \`${c.type}\` |`)
  return ["| column | type |", "|---|---|", ...rows].join("\n")
}

function describeMode(mode: string): string {
  switch (mode) {
    case "append-only":
      return "only ever inserts rows"
    case "retract":
      return "may retract previously emitted rows"
    case "upsert":
      return "updates rows by key"
    default:
      return "has this changelog behavior"
  }
}

function describeLevel(level: DecodedParallelism["level"]): string {
  switch (level) {
    case "prop":
      return "the `parallelism` prop on the `<Pipeline>`"
    case "env":
      return "an environment override"
    case "config":
      return "the project config (`flink-reactor.config.ts`)"
    default:
      return "the built-in default (no prop, override, or config set it)"
  }
}
