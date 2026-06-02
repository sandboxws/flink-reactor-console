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
  readonly pipelineManifest: PipelineManifest | null
  readonly crdYaml: string
  /** Construct nodes in creation order — the mapper's source of truth for
   *  node count (mismatch detection) and any `__loc` fast-path. */
  readonly nodes: readonly NodeProjection[]
  /** Set when `ok === false`. */
  readonly loadError?: LoadError
}

/** Re-export for convenience so providers import diagnostics from one place. */
export type { ValidationDiagnostic }
