// The `flinkReactor/graphModel` wire contract.
//
// A plain-JSON projection of one document version's synthesis result, shaped
// for a *dumb* webview renderer: every field is a JSON primitive/array/object
// — no `ConstructNode`, `SynthContext`, or other DSL runtime reference leaks
// in. The language server assembles it (see `src/providers/graph-model.ts`);
// the VS Code extension imports these types from `@flink-reactor/language-server`
// (re-exported by `server.ts`) so the host and the bundled webview share one
// contract.

/** An inferred schema column (name + Flink SQL type). */
export interface GraphModelColumn {
  readonly name: string
  readonly type: string
}

/** A node's validation finding, projected for a badge + tooltip. */
export interface GraphModelDiagnostic {
  readonly severity: "error" | "warning"
  /** `FR-*` category (`schema`/`connector`/`structure`/`changelog`/…). */
  readonly category?: string
  readonly message: string
}

/** One pipeline node. Identity is the `ConstructNode.id` — stable across
 *  refreshes so the webview can preserve positions/selection by matching ids. */
export interface GraphModelNode {
  readonly id: string
  /** `NodeKind` (`Source`/`Transform`/`Join`/`Window`/`Sink`/…) — the webview
   *  colors by this using the `fr graph` palette. */
  readonly kind: string
  /** Component class (`KafkaSource`, `Filter`, …). */
  readonly component: string
  /** Display label: the node's `name` prop, else its id (`fr graph` parity). */
  readonly label: string
  /** Inferred output columns, when synthesis resolved a schema for the node
   *  (sources/sinks). Absent for nodes with no resolved schema. */
  readonly schema?: readonly GraphModelColumn[]
  /** Resolved output changelog mode (`append-only`/`retract`/`upsert`). */
  readonly changelogMode?: string
  /** Indices into `GraphModelResponse.statements` this node emitted (the
   *  inverted `statementOrigins`). Empty for nodes that own no statement (a
   *  transform contributes a fragment to a DML statement it does not own). */
  readonly statementIndices: readonly number[]
  /** Optional topological rank (longest-path over the DAG) — a layout hint. */
  readonly layer?: number
  /** Validation findings attached to this node by `nodeId`. */
  readonly diagnostics: readonly GraphModelDiagnostic[]
}

/** A directed dataflow edge. */
export interface GraphModelEdge {
  readonly from: string
  readonly to: string
  /** The changelog mode flowing across the edge (the upstream node's mode). */
  readonly changelogMode?: string
  /** True when this edge connects the `sourceNodeId`/`sinkNodeId` of a
   *  cross-node changelog violation — the webview highlights it distinctly. */
  readonly crossNode?: boolean
}

/** The `flinkReactor/graphModel` response envelope. */
export interface GraphModelResponse {
  readonly uri: string
  /** The document version the model was built for; the client ignores a
   *  response older than what it has already rendered. */
  readonly version: number
  /** `false` when synthesis failed for this document — `error` is then set and
   *  `nodes`/`edges` are empty (the webview keeps its last good graph dimmed). */
  readonly ok: boolean
  readonly error?: string
  readonly nodes: readonly GraphModelNode[]
  readonly edges: readonly GraphModelEdge[]
  /** The generated SQL statements, indexed by `GraphModelNode.statementIndices`
   *  so the dumb webview can render a node's emitted SQL in its hover card. */
  readonly statements: readonly string[]
}

/** The `flinkReactor/graphModel` request parameters. */
export interface GraphModelParams {
  readonly uri: string
  /** The version the client currently has, if any (advisory). */
  readonly version?: number
}

/** The `flinkReactor/nodeRange` request parameters — resolve a clicked node's
 *  source range for click-to-source navigation. */
export interface NodeRangeParams {
  readonly uri: string
  readonly nodeId: string
}

/** A 0-based source range (mirrors LSP `Range`). `null` when the node has no
 *  mapped source position (e.g. a position-map mismatch). */
export interface NodeRangeResult {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number }
    readonly end: { readonly line: number; readonly character: number }
  } | null
}

/** The `flinkReactor/synthesized` notification payload — emitted after each
 *  debounced re-synthesis so an open graph panel can re-request the model. */
export interface SynthesizedNotification {
  readonly uri: string
  readonly version: number
}

/** The custom LSP method names, centralized so client and server agree. */
export const GRAPH_MODEL_REQUEST = "flinkReactor/graphModel"
export const NODE_RANGE_REQUEST = "flinkReactor/nodeRange"
export const SYNTHESIZED_NOTIFICATION = "flinkReactor/synthesized"
