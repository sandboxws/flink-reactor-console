// The `flinkReactor/crdPreview` wire contract — the CRD/artifact-set projection.
//
// A plain-JSON serialization of one document version's *already-computed*
// synthesis result, shaped for a read-only, tabbed Kubernetes-artifact preview
// webview. The language server assembles it (see `src/providers/crd-preview.ts`)
// by re-projecting the worker-serialized artifact strings the synthesis result
// already holds — it never re-runs synthesis. The VS Code extension imports
// these types from `@flink-reactor/language-server` (re-exported by `server.ts`)
// so the host and the bundled webview share one contract.
//
// This supersedes the IntelliJ `intellij-tier-2-feature-7` `crd-preview` change:
// it reuses the request *name* but redefines the payload from a single CRD
// string to the full per-pipeline artifact set (CRD/blue-green, wrapping
// ConfigMap, Flink CDC `pipeline.yaml`, and secondary resources).

import type { PipelineKind } from "../synth/types.js"

/** One read-only YAML tab in the preview — a single serialized Kubernetes
 *  artifact (or the Flink CDC `pipeline.yaml`). Mirrors `DecodedArtifact`. */
export interface CrdArtifact {
  /** Stable id within the set (e.g. `crd`, `configmap`, `pipeline-yaml`,
   *  `secondary:<name>`) — keys tabs across refreshes for in-place patching. */
  readonly id: string
  /** Display label (the resource `metadata.name`, or the CDC filename). */
  readonly label: string
  /** Target `dist/<pipeline>/` filename, mirroring `fr synth`. */
  readonly filename: string
  /** Kubernetes `kind`, or the sentinel `pipeline-yaml` for the CDC document. */
  readonly kind: string
  /** The serialized YAML document, produced by the browser-safe `toYaml`. */
  readonly yaml: string
}

/** A pipeline's artifact-set status — distinguishes a good set, a synthesis
 *  failure (so the client can show last-good + a stale banner), and a document
 *  with no synthesizable pipeline. */
export type CrdPreviewStatus = "ok" | "error" | "no-pipeline"

/** One pipeline's artifact set (the document currently defines 0 or 1). */
export interface CrdPreviewPipeline {
  /** The `<Pipeline name>` prop, else `"pipeline"`. */
  readonly pipelineName: string
  /** Server-authoritative artifact shape — drives the header label and which
   *  tabs are present (a CDC pipeline never shows a FlinkDeployment tab). */
  readonly pipelineKind: PipelineKind
  readonly status: CrdPreviewStatus
  /** The synthesis-failure summary when `status === "error"`. */
  readonly error?: string
  /** The artifacts in render order; empty when `status !== "ok"`. */
  readonly artifacts: readonly CrdArtifact[]
}

/** The `flinkReactor/crdPreview` response envelope. A synthesis failure never
 *  rejects the RPC — it resolves with a `status: "error"` pipeline so the
 *  client can fall back to its last-good set. `documentVersion` is the version
 *  the held result was synthesized from, so the client can detect staleness. */
export interface CrdPreviewResponse {
  readonly uri: string
  readonly documentVersion: number
  /** One entry per pipeline the document defines (currently always 0 or 1).
   *  Empty when the document has not been synthesized yet. */
  readonly pipelines: readonly CrdPreviewPipeline[]
}

/** The `flinkReactor/crdPreview` request parameters. */
export interface CrdPreviewParams {
  readonly uri: string
  /** The version the client currently has, if any (advisory; stamps the
   *  fallback envelope when nothing is cached yet). */
  readonly version?: number
}

/** The custom LSP method name, centralized so client and server agree. */
export const CRD_PREVIEW_REQUEST = "flinkReactor/crdPreview"
