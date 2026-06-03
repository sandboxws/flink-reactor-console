// `flinkReactor/crdPreview` assembler.
//
// A pure, host-side re-projection of one document version's decoded
// `SynthesisResult` into the plain-JSON `CrdPreviewResponse` the CRD-preview
// webview renders. The artifact YAML strings + the `pipelineKind` discriminator
// were already serialized in the worker (`synth/artifacts.ts`); this is a
// straight shape transform that adds the per-pipeline `status` and echoes the
// document version. NO synthesis, no DSL objects.

import type {
  CrdPreviewPipeline,
  CrdPreviewResponse,
} from "../preview/crd-model.js"
import type { SynthesisResult } from "../synth/types.js"

/** The container kind whose `name` prop is the pipeline's identity. */
const CONTAINER_KIND = "Pipeline"

/**
 * Build the CRD-preview model for a synthesized document. Never throws: a
 * failed synthesis becomes a `status: "error"` (or `"no-pipeline"`) pipeline
 * carrying the load-error message, so the client can keep its last-good set
 * behind a stale banner instead of seeing an RPC error.
 */
export function buildCrdPreviewModel(
  uri: string,
  version: number,
  result: SynthesisResult,
): CrdPreviewResponse {
  const pipelineName = pipelineIdentity(result)

  if (!result.ok) {
    // A `no-pipeline` load error (the `.tsx` has no synthesizable pipeline) is
    // distinct from a genuine synthesis failure (throw/load/timeout) so the
    // client can phrase the empty state correctly.
    const status =
      result.loadError?.kind === "no-pipeline" ? "no-pipeline" : "error"
    const pipeline: CrdPreviewPipeline = {
      pipelineName,
      pipelineKind: result.pipelineKind,
      status,
      ...(status === "error"
        ? { error: result.loadError?.message ?? "synthesis failed" }
        : {}),
      artifacts: [],
    }
    return { uri, documentVersion: version, pipelines: [pipeline] }
  }

  // Synthesis succeeded but produced no artifacts — treat as no-pipeline so the
  // webview shows the empty state rather than a header with zero tabs.
  if (result.artifacts.length === 0) {
    return {
      uri,
      documentVersion: version,
      pipelines: [
        {
          pipelineName,
          pipelineKind: result.pipelineKind,
          status: "no-pipeline",
          artifacts: [],
        },
      ],
    }
  }

  const pipeline: CrdPreviewPipeline = {
    pipelineName,
    pipelineKind: result.pipelineKind,
    status: "ok",
    artifacts: result.artifacts.map((a) => ({
      id: a.id,
      label: a.label,
      filename: a.filename,
      kind: a.kind,
      yaml: a.yaml,
    })),
  }
  return { uri, documentVersion: version, pipelines: [pipeline] }
}

/** The pipeline's identity: the `<Pipeline name>` prop on the container node,
 *  else `"pipeline"`. Stable across refreshes so the webview re-binds to the
 *  same pipeline. */
function pipelineIdentity(result: SynthesisResult): string {
  const container = result.nodes.find((n) => n.kind === CONTAINER_KIND)
  return container?.name ?? "pipeline"
}
