// Shared, **serializable** types for the synthesis layer.
//
// Everything here must survive `postMessage` (structured clone) because the
// synthesis result crosses the worker→host boundary. That means: no class
// instances, no functions, no `Map`/`Set` in the wire payload — plain
// objects and arrays only. (The DSL itself returns `Map`-typed source maps;
// the runner decodes those into arrays before they leave the worker.)

import type {
  FlinkMajorVersion,
  PipelineArtifact,
  ValidationCategory,
  ValidationDiagnostic,
} from "@flink-reactor/dsl/browser"

/** The DSL's pipeline manifest type, recovered via indexed access (it is not
 *  itself a named export of `@flink-reactor/dsl/browser`). */
export type PipelineManifest = PipelineArtifact["pipelineManifest"]

/** Why a load/synth attempt failed, used to shape the single diagnostic we
 *  surface for a broken pipeline. */
export type LoadErrorKind =
  | "eval" // user module threw while being evaluated
  | "no-default" // no default export
  | "not-a-node" // default export is not a ConstructNode / node-returning fn
  | "no-pipeline" // default export is not a <Pipeline>
  | "sql" // synthesis (SQL/CRD generation) threw
  | "timeout" // exceeded the synthesis timeout (isolation boundary)
  | "crash" // worker crashed / exited unexpectedly

export interface LoadError {
  readonly kind: LoadErrorKind
  readonly message: string
  readonly stack?: string
}

/** A construct node projected down to the serializable fields the source
 *  mapper needs: identity for pairing, plus an optional authoritative source
 *  range if the DSL ever stamps `__loc` (the predictor is the fallback). */
export interface NodeProjection {
  readonly id: string
  readonly component: string
  readonly kind: string
  /** The node's `name` prop, when set — the display label the graph model
   *  prefers over the id (mirroring `fr graph` `nodeLabel`'s `name ?? id`).
   *  Decoded here because props never cross the worker boundary. */
  readonly name?: string
  readonly loc?: SourceRange
}

/** A 0-based source range, mirroring LSP `Range` without importing the LSP
 *  types into the worker. */
export interface SourceRange {
  readonly start: { readonly line: number; readonly character: number }
  readonly end: { readonly line: number; readonly character: number }
}

/** Decoded `StatementOrigin` carrying its statement index. */
export interface DecodedOrigin {
  readonly statementIndex: number
  readonly nodeId: string
  readonly component: string
  readonly kind: string
}

/** Decoded `SqlFragment`: a byte span within a statement attributed to a node. */
export interface DecodedFragment {
  readonly offset: number
  readonly length: number
  readonly nodeId: string
  readonly component: string
  readonly kind: string
}

/** Decoded `statementContributors` entry: all nodes contributing to a statement. */
export interface DecodedContributor {
  readonly statementIndex: number
  readonly fragments: readonly DecodedFragment[]
}

/** Decoded per-statement hover metadata. `StatementMeta` is already a plain
 *  object, so it is carried through unchanged alongside its index. */
export interface DecodedStatementMeta {
  readonly statementIndex: number
  readonly meta: unknown
}

/** A directed dataflow edge (`from` → `to`) decoded from the synthesis-time
 *  `SynthContext`. The graph cannot cross the worker boundary (it is a class
 *  with `Map` internals), so its edges are flattened here for the hover
 *  provider to recover upstream/downstream neighbors. Built from the
 *  chain-aware dataflow topology (not the naive parent→child tree). */
export interface DecodedEdge {
  readonly from: string
  readonly to: string
}

/** A node's resolved output changelog mode, computed during synthesis via the
 *  DSL's `computeChangelogModes`. Carried per-node because it is *not* a field
 *  on `StatementMeta`. `mode` is a DSL `ChangelogMode`
 *  (`append-only`/`retract`/`upsert`). */
export interface DecodedChangelogMode {
  readonly nodeId: string
  readonly mode: string
}

/** Which artifact *shape* a pipeline synthesizes to. A standard SQL pipeline
 *  emits a `FlinkDeployment`/`FlinkBlueGreenDeployment` CRD plus a wrapping
 *  ConfigMap; a Flink CDC Pipeline Connector source emits a `pipeline.yaml`
 *  plus a `configmap.yaml` and no `FlinkDeployment`. The discriminator is
 *  server-authoritative (derived from the artifact, never re-inferred client-
 *  side) so the `crd-preview` header/tab set can never mislabel. */
export type PipelineKind = "standard" | "cdc-pipeline"

/** One serialized Kubernetes artifact in a pipeline's generated set — the unit
 *  the `crd-preview` webview renders as a single read-only YAML tab. The YAML
 *  is produced in the worker (via the browser-safe `toYaml`) because the live
 *  CRD / secondary-resource objects cannot cross the worker boundary; only the
 *  serialized strings do. `filename` mirrors the `dist/<pipeline>/` name `fr
 *  synth` writes so "save to dist/" reproduces the CLI layout. */
export interface DecodedArtifact {
  /** Stable id within the set (e.g. `crd`, `configmap`, `pipeline-yaml`,
   *  `secondary:<name>`) — lets the webview key tabs across refreshes. */
  readonly id: string
  /** Display label (the resource's `metadata.name`, or the filename for the
   *  CDC `pipeline.yaml`). */
  readonly label: string
  /** Target filename under `dist/<pipeline>/` (`deployment.yaml`,
   *  `configmap.yaml`, `pipeline.yaml`, …). */
  readonly filename: string
  /** Kubernetes `kind` (`FlinkDeployment`/`FlinkBlueGreenDeployment`/`ConfigMap`)
   *  or the sentinel `pipeline-yaml` for the Flink CDC pipeline document. */
  readonly kind: string
  /** The serialized YAML document. */
  readonly yaml: string
}

/** The changelog modes a sink node accepts, decoded from the DSL's private
 *  sink-acceptance rule (which needs the live node + props, unavailable host-
 *  side). Lets the hover sink card show accepted modes + upstream compatibility
 *  without re-deriving from a component name alone. */
export interface DecodedSinkAccept {
  readonly nodeId: string
  readonly accepts: readonly string[]
}

/** The schema *feeding* a node's expressions — the columns visible to a
 *  `Filter` condition, a `Map` projection, a join `on`, etc. Resolved in the
 *  worker by folding `resolveTransformSchema` along the dataflow graph (so
 *  renames/joins/windows are reflected), with a construct-tree-parent fallback
 *  for config sub-nodes (e.g. `Query.Select`) that carry no dataflow edge of
 *  their own. Column completion + the hover column-ref card read this; it cannot
 *  be recomputed host-side because the `SynthContext`/tree never cross the
 *  worker boundary. */
export interface DecodedNodeSchema {
  readonly nodeId: string
  readonly columns: readonly { readonly name: string; readonly type: string }[]
}

/** Request payload sent to the synthesis worker (and accepted by the pure
 *  in-process runner). */
export interface SynthesisInput {
  /** Absolute path to the pipeline entry `.tsx`. */
  readonly entryPoint: string
  /** Project root (for `@/` alias + config resolution). */
  readonly projectDir: string
  /** Current document buffer. When present, synthesis runs against the
   *  buffer (via an adjacent temp file) rather than the on-disk file. */
  readonly documentText?: string
  /** Target Flink version; defaults to the DSL default when omitted. */
  readonly flinkVersion?: FlinkMajorVersion
}

/** The decoded, serializable synthesis result shared with every provider. */
export interface SynthesisResult {
  /** `true` when synthesis produced SQL; `false` when a load/synth error
   *  short-circuited it (`loadError` is then set). */
  readonly ok: boolean
  readonly statements: readonly string[]
  readonly sql: string
  /** FlinkReactor validation findings (severity/message/nodeId/category). */
  readonly diagnostics: readonly ValidationDiagnostic[]
  readonly statementOrigins: readonly DecodedOrigin[]
  readonly statementContributors: readonly DecodedContributor[]
  readonly statementMeta: readonly DecodedStatementMeta[]
  /** Flattened dataflow edges (chain-aware) for upstream/downstream neighbors.
   *  Linear-chain scoped — collapses nesting; use `dagEdges` for the full DAG. */
  readonly edges: readonly DecodedEdge[]
  /** Full visualization DAG edges: sibling chains **plus** Route/SideOutput
   *  fan-out and Join fan-in, computed in the worker from the construct tree.
   *  The graph-model request reads these (host-side `getAllEdges()` cannot see
   *  the tree/props). */
  readonly dagEdges: readonly DecodedEdge[]
  /** Per-node resolved output changelog mode (sources..sinks). */
  readonly changelogModes: readonly DecodedChangelogMode[]
  /** Accepted changelog modes per sink node (for sink-card compatibility). */
  readonly sinkChangelogAccepts: readonly DecodedSinkAccept[]
  /** Per-node input schema (columns visible to the node's expression props),
   *  for column completion + the hover column-ref card. */
  readonly nodeInputSchemas: readonly DecodedNodeSchema[]
  readonly pipelineManifest: PipelineManifest | null
  readonly crdYaml: string
  /** Which artifact shape the pipeline synthesized to (`standard` for a
   *  FlinkDeployment + ConfigMap, `cdc-pipeline` for a Flink CDC `pipeline.yaml`
   *  + ConfigMap). Defaults to `standard` on a failed/empty synthesis. */
  readonly pipelineKind: PipelineKind
  /** The full generated Kubernetes artifact set, serialized in the worker for
   *  the `crd-preview` capability. Empty on a failed/empty synthesis. */
  readonly artifacts: readonly DecodedArtifact[]
  /** Construct nodes in creation order — the mapper's source of truth for
   *  node count (mismatch detection) and any `__loc` fast-path. */
  readonly nodes: readonly NodeProjection[]
  /** Set when `ok === false`. */
  readonly loadError?: LoadError
}

/** Re-export for convenience so providers import diagnostics from one place. */
export type { ValidationCategory, ValidationDiagnostic }
