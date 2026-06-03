// Serializes a synthesized `PipelineArtifact` into the plain-JSON artifact set
// the `crd-preview` capability presents.
//
// This runs **inside the synthesis worker** (called from `runner.ts`) because
// the live `crd` / `secondaryResources` objects cannot cross the worker
// boundary — only the serialized YAML strings can. The shape and filenames
// mirror what the CLI's `fr synth` writes under `dist/<pipeline>/`
// (`src/cli/commands/synth.ts` `writePipelineOutput`), so the preview's
// "save to dist/" reproduces the CLI layout exactly:
//
//   standard SQL pipeline  → deployment.yaml (CRD) + configmap.yaml (SQL ConfigMap)
//   Flink CDC pipeline     → pipeline.yaml          + configmap.yaml (secondary)
//
// Either shape may carry additional `secondaryResources` (each emitted as its
// own `<kind>.yaml`). The `pipelineKind` discriminator is taken from the
// artifact shape (a CDC pipeline-connector source sets `pipelineYaml`), never
// re-inferred client-side.

import { type PipelineArtifact, toYaml } from "@flink-reactor/dsl/browser"
import type { DecodedArtifact, PipelineKind } from "./types.js"

export interface ArtifactSet {
  readonly pipelineKind: PipelineKind
  readonly artifacts: readonly DecodedArtifact[]
}

/**
 * Build the serialized artifact set for one synthesized pipeline. Pure and
 * deterministic — the same `PipelineArtifact` always yields the same YAML and
 * ordering (CRD/pipeline.yaml first, then the wrapping ConfigMap, then each
 * secondary resource in declaration order).
 */
export function buildArtifactSet(pipeline: PipelineArtifact): ArtifactSet {
  const artifacts: DecodedArtifact[] = []
  // A Flink CDC Pipeline Connector source sets `pipelineYaml`; a standard SQL
  // pipeline leaves it null. This is the single source of truth for the kind.
  const isCdc = pipeline.pipelineYaml != null

  if (isCdc) {
    // CDC: the Flink CDC `pipeline.yaml` replaces the FlinkDeployment tab. Its
    // wrapping ConfigMap (and any other resources) come from `secondaryResources`.
    artifacts.push({
      id: "pipeline-yaml",
      label: "pipeline.yaml",
      filename: "pipeline.yaml",
      kind: "pipeline-yaml",
      yaml: pipeline.pipelineYaml as string,
    })
  } else {
    // Standard: the FlinkDeployment/FlinkBlueGreenDeployment CRD plus the
    // ConfigMap that wraps the synthesized SQL.
    artifacts.push({
      id: "crd",
      label: pipeline.crd.metadata.name,
      filename: "deployment.yaml",
      kind: pipeline.crd.kind,
      yaml: toYaml(pipeline.crd),
    })
    artifacts.push(sqlConfigMapArtifact(pipeline))
  }

  // Secondary resources (ConfigMaps, ServiceAccounts, …) — one tab each, named
  // `<kind>.yaml` to match `fr synth` (so the CDC pipeline-yaml ConfigMap lands
  // as `configmap.yaml`).
  for (const res of pipeline.secondaryResources) {
    artifacts.push({
      id: `secondary:${res.metadata.name}`,
      label: res.metadata.name,
      filename: `${res.kind.toLowerCase()}.yaml`,
      kind: res.kind,
      yaml: toYaml(res),
    })
  }

  return { pipelineKind: isCdc ? "cdc-pipeline" : "standard", artifacts }
}

/**
 * The wrapping `ConfigMap` a standard SQL pipeline emits — `<pipeline>-sql`
 * holding `pipeline.sql`. Mirrors `buildConfigMapYaml` in the CLI's `synth.ts`;
 * kept inline here (rather than imported) because that helper lives in the
 * Node-only CLI layer and this module is browser-safe (worker-resident).
 */
function sqlConfigMapArtifact(pipeline: PipelineArtifact): DecodedArtifact {
  const name = `${pipeline.name}-sql`
  const yaml = toYaml({
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name },
    data: { "pipeline.sql": pipeline.sql.sql },
  })
  return {
    id: "configmap",
    label: name,
    filename: "configmap.yaml",
    kind: "ConfigMap",
    yaml,
  }
}
