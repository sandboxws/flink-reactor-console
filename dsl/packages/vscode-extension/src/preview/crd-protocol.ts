// The `crd-preview` custom-LSP wire contract, extension side.
//
// Mirrors `preview/protocol.ts`: the *types* are the single source of truth
// from `@flink-reactor/language-server` (imported type-only, so esbuild erases
// them — the heavy server module is NEVER pulled into the extension bundle).
// The method-name *string* is re-declared here so importing it as a runtime
// value never drags the server module in.
//
// Live refresh piggybacks `flinkReactor/synthesized` (via the client's
// `onSynthesized` event) — the same debounced signal the DAG + SQL panels use.

export const CRD_PREVIEW_REQUEST = "flinkReactor/crdPreview"

export type {
  CrdArtifact,
  CrdPreviewParams,
  CrdPreviewPipeline,
  CrdPreviewResponse,
  CrdPreviewStatus,
  PipelineKind,
} from "@flink-reactor/language-server"
