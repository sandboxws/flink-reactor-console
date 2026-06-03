// The `flinkReactor/synth` wire contract — the SQL-preview projection.
//
// A plain-JSON serialization of one document version's *already-computed*
// synthesis result, shaped for a read-only SQL-preview webview with
// bidirectional source mapping. The language server assembles it (see
// `src/providers/synth-model.ts`) by serializing the decoded source maps —
// it never re-runs synthesis. The VS Code extension imports these types from
// `@flink-reactor/language-server` (re-exported by `server.ts`) so the host
// and the bundled webview share one contract.
//
// The DSL's per-statement source maps are `Map<number, …>` (statement index →
// value). LSP JSON has no `Map`, so the maps cross the wire as `[index, value]`
// entry arrays and the webview reconstructs `Map`s from them (covered by a
// round-trip test). SQL→DSL navigation reuses the pre-existing
// `flinkReactor/nodeRange` request (`{ uri, nodeId }` → `Range | null`) — it is
// the node-locate companion the spec calls `locateNode`, already shipped by the
// `dag-visualization` capability, so no duplicate method is introduced.

/** Which construct node produced a whole statement (the inverted
 *  `statementOrigins`). Absent for synthetic statements (SET banners, the
 *  STATEMENT SET wrapper) that have no single originating node. */
export interface SynthStatementOrigin {
  readonly nodeId: string
  readonly component: string
  readonly kind: string
}

/** A byte span within a statement attributed to a single node — e.g. the exact
 *  `WHERE` predicate substring a `<Filter>` contributed. `origin` is the
 *  contributing node's id (the DSL's `SqlFragment.origin.nodeId`); the webview
 *  filters by `origin === activeNodeId` for sub-statement highlighting and
 *  hit-tests a click offset against these spans for SQL→DSL navigation. */
export interface SynthFragment {
  /** Byte offset from the start of the statement text. */
  readonly offset: number
  /** Length in bytes. */
  readonly length: number
  /** The contributing node's id. */
  readonly origin: string
}

/** Per-statement label + section, projected from the DSL's `StatementMeta`.
 *  `label` titles each rendered block (e.g. "KafkaSource: orders"); `section`
 *  drives the SET / CREATE CATALOG / CREATE TABLE / INSERT INTO grouping. */
export interface SynthStatementMeta {
  readonly label: string
  /** The DSL `SqlSection` (`configuration`/`catalogs`/`sources`/`sinks`/…). */
  readonly section: string
  readonly kind?: string
  readonly component?: string
}

/** One pipeline's synthesized SQL plus its source maps, serialized as
 *  `[index, value]` entry arrays so number keys round-trip through LSP JSON. */
export interface SynthPipeline {
  /** Pipeline identity — the `<Pipeline name>` prop, else `"pipeline"`. Lets a
   *  multi-pipeline document key results unambiguously. */
  readonly id: string
  /** Statements in canonical synthesis order (SET → CREATE … → INSERT INTO). */
  readonly statements: readonly string[]
  /** statement index → producing node. */
  readonly statementOrigins: ReadonlyArray<
    readonly [number, SynthStatementOrigin]
  >
  /** statement index → contributing byte spans. */
  readonly statementContributors: ReadonlyArray<
    readonly [number, readonly SynthFragment[]]
  >
  /** statement index → block label + section. */
  readonly statementMeta: ReadonlyArray<readonly [number, SynthStatementMeta]>
}

/** The `flinkReactor/synth` response envelope. Mirrors the `graphModel`
 *  envelope: `ok: false` carries a failure summary and an empty `pipelines`
 *  array so the webview falls back to its last good SQL instead of seeing an
 *  RPC error. The `version` is the document version the cached result was
 *  synthesized from, so the client can detect staleness. */
export interface SynthResponse {
  readonly uri: string
  readonly version: number
  /** `false` when the document has no cached good synthesis (never synthesized,
   *  or the latest pass failed) — `error` is then the failure summary. */
  readonly ok: boolean
  readonly error?: string
  /** One entry per pipeline the document defines (currently always 0 or 1). */
  readonly pipelines: readonly SynthPipeline[]
}

/** The `flinkReactor/synth` request parameters. */
export interface SynthParams {
  readonly uri: string
  /** The version the client currently has, if any (advisory; used to stamp the
   *  fallback envelope when nothing is cached yet). */
  readonly version?: number
}

/** `flinkReactor/nodeAtPosition` request — the inverse of `nodeRange`. Resolves
 *  a caret/selection position in the `.tsx` to the innermost node under it, so
 *  the SQL preview can drive DSL→SQL highlighting from the editor caret. Kept
 *  server-side (vs. shipping the whole position map) so there is one versioned
 *  source of truth. */
export interface NodeAtPositionParams {
  readonly uri: string
  readonly position: { readonly line: number; readonly character: number }
}

/** `null` when no node's range contains the position. */
export interface NodeAtPositionResult {
  readonly nodeId: string | null
}

/** The custom LSP method names, centralized so client and server agree. */
export const SYNTH_REQUEST = "flinkReactor/synth"
export const NODE_AT_POSITION_REQUEST = "flinkReactor/nodeAtPosition"
