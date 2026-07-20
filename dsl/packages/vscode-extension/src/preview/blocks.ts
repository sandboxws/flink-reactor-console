// The SQL-preview view model — pure, DOM-free, so it unit-tests in plain Node
// (like `graph/webview/layout.ts`). It turns one `SynthPipeline` (raw statements
// + the number-keyed source maps as entry arrays) into titled, source-attributed
// blocks and provides the byte-offset ↔ node bridges both directions:
//
//   buildBlocks  — fold the interleaved `-- ===` banners + executable SQL into
//                  titled blocks (banner label → next statement).
//   segment      — split a block's SQL at contributor byte-span boundaries, the
//                  overlay model the renderer wraps in highlightable elements
//                  (independent of any decorative tokenization).
//   hitTest      — SQL→DSL: a character offset → the owning node id.
//   blockMatches — DSL→SQL: which whole-statement / sub-statement spans light up
//                  for an active node id.
//
// The DSL keys `statementMeta` to the comment banner that *precedes* a real
// statement, keys `statementOrigins` to the real statement, and leaves DML
// (INSERT / STATEMENT SET) with no single origin but with contributor spans.

import type {
  SynthFragment,
  SynthPipeline,
  SynthStatementMeta,
  SynthStatementOrigin,
} from "./protocol.js"

/** A contributing byte span within a block's SQL, attributed to one node. */
export interface BlockFragment {
  readonly offset: number
  readonly length: number
  /** The contributing node's id (the DSL `SqlFragment.origin.nodeId`). */
  readonly origin: string
}

/** One rendered SQL block: a titled executable statement plus its source
 *  attributions. Comment banners are folded away into `label`/`section`. */
export interface PreviewBlock {
  /** Stable identity = the statement's index in the raw `statements` array.
   *  Used for DOM ids + scroll preservation across refreshes. */
  readonly index: number
  /** Heading from the preceding banner's `statementMeta.label`, else derived
   *  from the statement's own origin/section. */
  readonly label: string
  /** The DSL `SqlSection` (`configuration`/`catalogs`/`sources`/`sinks`/
   *  `pipeline`/…) — drives section grouping in the renderer. */
  readonly section: string
  /** The executable statement text (banners excluded). Offsets in `fragments`
   *  index into this string. */
  readonly sql: string
  /** The node that owns the whole statement (e.g. a source's `CREATE TABLE`).
   *  Absent for DML, which has no single origin. */
  readonly originNodeId?: string
  /** Contributing sub-statement spans into `sql`, sorted by offset. */
  readonly fragments: readonly BlockFragment[]
}

/** A run of a block's SQL text, optionally attributed to a contributing node.
 *  The renderer wraps `origin`-bearing runs in highlightable elements. */
export interface Segment {
  readonly text: string
  readonly origin?: string
}

/** The empty-state copy for a pipeline that synthesized *successfully* but has
 *  no SQL to preview — `buildBlocks` returned no blocks because every statement
 *  is a `--` comment banner (e.g. a Flink CDC Pipeline Connector job whose
 *  runtime lives in `pipeline.yaml`, not Flink SQL). `heading` is the one-line
 *  summary; `detail` is a longer explanation (may be empty). Lives in this pure
 *  module so it unit-tests without a DOM and never reuses the "Waiting…"
 *  placeholder, which must mean *only* "no synth received yet". */
export interface NoSqlMessage {
  readonly heading: string
  readonly detail: string
}

/** A comment-only banner statement (Flink line comments start with `--`); never
 *  a real statement, which would be commented out if it started with `--`. */
function isBanner(sql: string): boolean {
  return sql.trimStart().startsWith("--")
}

/**
 * Fold the raw interleaved `statements` into titled blocks. A `--` banner at
 * index `b` lends its `statementMeta` label/section to the *next* executable
 * statement and is itself dropped; an executable statement with no preceding
 * banner falls back to its own meta, then to a label derived from its origin.
 */
export function buildBlocks(pipeline: SynthPipeline): PreviewBlock[] {
  const origins = new Map<number, SynthStatementOrigin>(
    pipeline.statementOrigins,
  )
  const contributors = new Map<number, readonly SynthFragment[]>(
    pipeline.statementContributors,
  )
  const meta = new Map<number, SynthStatementMeta>(pipeline.statementMeta)

  const blocks: PreviewBlock[] = []
  let pending: SynthStatementMeta | undefined
  pipeline.statements.forEach((sql, i) => {
    if (isBanner(sql)) {
      // Carry the banner's label/section to the following real statement.
      pending = meta.get(i) ?? pending
      return
    }
    const own = meta.get(i)
    const origin = origins.get(i)
    const label =
      pending?.label ||
      own?.label ||
      labelFromOrigin(origin) ||
      `Statement ${blocks.length + 1}`
    const section = pending?.section || own?.section || ""
    const fragments = [...(contributors.get(i) ?? [])]
      .map(
        (f): BlockFragment => ({
          offset: f.offset,
          length: f.length,
          origin: f.origin,
        }),
      )
      .sort((a, b) => a.offset - b.offset)
    blocks.push({
      index: i,
      label,
      section,
      sql,
      ...(origin ? { originNodeId: origin.nodeId } : {}),
      fragments,
    })
    pending = undefined
  })
  return blocks
}

/** A readable fallback label when no `statementMeta` is attached (e.g. a
 *  programmatic statement): "KafkaSource (orders)". */
function labelFromOrigin(origin?: SynthStatementOrigin): string | undefined {
  if (!origin) return undefined
  return `${origin.component} (${origin.nodeId})`
}

/**
 * Compose the empty-state message for a pipeline that synthesized successfully
 * but produced no SQL blocks (every statement is a `--` banner). The webview
 * calls this when `buildBlocks` returns `[]`, so the preview shows a real
 * explanation instead of getting stuck on the "Waiting…" placeholder.
 *
 * `detail` surfaces the DSL's own banner explanation as prose: the banners
 * already say where the runtime lives (for a CDC Pipeline Connector job,
 * literally "The runtime definition lives in pipeline.yaml … inspect
 * pipeline.yaml and deployment.yaml"), so the empty state reuses that
 * DSL-authored copy instead of inventing its own. Comment markers and banner
 * furniture (`====` rules, ALL-CAPS title lines) are dropped; sentence lines
 * are kept verbatim. Renders in a `<pre>`, so `\n` joins are line breaks.
 */
export function noSqlMessage(pipeline: SynthPipeline): NoSqlMessage {
  const heading =
    pipeline.statements.length === 0
      ? "This pipeline produced no statements."
      : "No SQL to preview for this pipeline."
  const detail = pipeline.statements
    .flatMap((s) => s.split("\n"))
    .map((line) => line.replace(/^\s*--\s?/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[=-\s]+$/.test(line)) // `====` banner rules
    .filter((line) => /[a-z]/.test(line)) // ALL-CAPS titles aren't prose
    .join("\n")
  return { heading, detail }
}

/**
 * Split a block's `sql` into ordered segments at fragment boundaries — the
 * byte-offset → rendered-span overlay model (task 3.5). Built from the raw text
 * so spans stay correct independently of any decorative SQL tokenization.
 * Fragments are non-overlapping in practice (each byte is attributed to at most
 * one node); overlaps degrade gracefully to first-wins, and offsets are clamped
 * to the text length.
 */
export function segment(
  sql: string,
  fragments: readonly BlockFragment[],
): Segment[] {
  if (fragments.length === 0) return sql ? [{ text: sql }] : []
  const sorted = [...fragments].sort((a, b) => a.offset - b.offset)
  const out: Segment[] = []
  let cursor = 0
  for (const f of sorted) {
    const start = Math.max(cursor, Math.min(f.offset, sql.length))
    const end = Math.max(start, Math.min(f.offset + f.length, sql.length))
    if (start > cursor) out.push({ text: sql.slice(cursor, start) })
    if (end > start) out.push({ text: sql.slice(start, end), origin: f.origin })
    cursor = Math.max(cursor, end)
  }
  if (cursor < sql.length) out.push({ text: sql.slice(cursor) })
  return out
}

/**
 * SQL→DSL: resolve a click/caret character offset within a block to the owning
 * node id — the contributing fragment under the offset, else the block's
 * whole-statement origin. `undefined` when neither exists (a STATEMENT SET
 * wrapper / section header), so the caller selects nothing and shows no error.
 */
export function hitTest(
  block: PreviewBlock,
  offset: number,
): string | undefined {
  for (const f of block.fragments) {
    if (offset >= f.offset && offset < f.offset + f.length) return f.origin
  }
  return block.originNodeId
}

/** DSL→SQL: what lights up in a block for `nodeId` — the whole statement (when
 *  it produced it) and/or the specific contributed spans (e.g. a `<Filter>`'s
 *  `WHERE` predicate). `whole === false` with empty `spans` means no match. */
export function blockMatches(
  block: PreviewBlock,
  nodeId: string,
): { whole: boolean; spans: BlockFragment[] } {
  return {
    whole: block.originNodeId === nodeId,
    spans: block.fragments.filter((f) => f.origin === nodeId),
  }
}
