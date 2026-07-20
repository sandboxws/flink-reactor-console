import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { buildCrdPreviewModel } from "../../src/providers/crd-preview"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

/** Synthesize a fixture and project it through the crd-preview assembler. */
async function model(name: string, version = 11) {
  const entryPoint = join(FIXTURES, name)
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  return buildCrdPreviewModel(pathToFileURL(entryPoint).href, version, result)
}

describe("buildCrdPreviewModel", () => {
  // 1.3 — a standard SQL pipeline emits a FlinkDeployment CRD (deployment.yaml)
  // and the wrapping SQL ConfigMap (configmap.yaml).
  it("projects a standard pipeline to a FlinkDeployment + ConfigMap set", async () => {
    const m = await model("dag-linear-pipeline.tsx")

    expect(m.documentVersion).toBe(11)
    expect(m.pipelines).toHaveLength(1)
    const [p] = m.pipelines
    expect(p.status).toBe("ok")
    expect(p.pipelineKind).toBe("standard")
    expect(p.pipelineName).toBe("dag-linear")

    const deployment = p.artifacts.find((a) => a.id === "crd")
    expect(deployment?.kind).toBe("FlinkDeployment")
    expect(deployment?.filename).toBe("deployment.yaml")
    expect(deployment?.yaml).toContain("kind: FlinkDeployment")

    const configMap = p.artifacts.find((a) => a.id === "configmap")
    expect(configMap?.kind).toBe("ConfigMap")
    expect(configMap?.filename).toBe("configmap.yaml")
    expect(configMap?.yaml).toContain("pipeline.sql")
  })

  // 1.3 — a blue-green upgrade strategy serializes as the FlinkBlueGreenDeployment
  // kind (the artifact's `kind` and YAML reflect the resource).
  it("serializes a blue-green pipeline as FlinkBlueGreenDeployment", async () => {
    const [p] = (await model("crd-blue-green-pipeline.tsx")).pipelines

    expect(p.status).toBe("ok")
    expect(p.pipelineKind).toBe("standard")
    const deployment = p.artifacts.find((a) => a.id === "crd")
    expect(deployment?.kind).toBe("FlinkBlueGreenDeployment")
    expect(deployment?.yaml).toContain("kind: FlinkBlueGreenDeployment")
  })

  // 1.4/1.5 — a CDC pipeline-connector source emits a pipeline.yaml tab (no
  // FlinkDeployment) plus the configmap.yaml secondary resource.
  it("projects a CDC pipeline to pipeline.yaml + configmap.yaml", async () => {
    const [p] = (await model("crd-cdc-pipeline.tsx")).pipelines

    expect(p.status).toBe("ok")
    expect(p.pipelineKind).toBe("cdc-pipeline")

    const pipelineYaml = p.artifacts.find((a) => a.id === "pipeline-yaml")
    expect(pipelineYaml?.kind).toBe("pipeline-yaml")
    expect(pipelineYaml?.filename).toBe("pipeline.yaml")
    expect(pipelineYaml?.yaml.length).toBeGreaterThan(0)

    // The CDC pipeline.yaml ConfigMap arrives as a secondary resource named
    // `configmap.yaml` — and there is no FlinkDeployment tab.
    const configMap = p.artifacts.find((a) => a.filename === "configmap.yaml")
    expect(configMap?.kind).toBe("ConfigMap")
    expect(p.artifacts.some((a) => a.kind === "FlinkDeployment")).toBe(false)
  })

  // 1.5 — every secondary resource appears as its own artifact (the CDC fixture
  // carries the pipeline.yaml ConfigMap as a secondary resource).
  it("emits secondary resources as their own artifacts", async () => {
    const [p] = (await model("crd-cdc-pipeline.tsx")).pipelines
    const secondary = p.artifacts.filter((a) => a.id.startsWith("secondary:"))
    expect(secondary.length).toBeGreaterThan(0)
    for (const a of secondary) {
      expect(a.yaml.length).toBeGreaterThan(0)
      expect(a.filename.endsWith(".yaml")).toBe(true)
    }
  })

  // 1.6 — a throwing pipeline resolves with a `status: "error"` carrying the
  // message, not an RPC rejection, and never throws while projecting.
  it("returns a status:error pipeline for a throwing pipeline", async () => {
    const entryPoint = join(FIXTURES, "throwing-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })

    let m: ReturnType<typeof buildCrdPreviewModel> | undefined
    expect(() => {
      m = buildCrdPreviewModel(pathToFileURL(entryPoint).href, 4, result)
    }).not.toThrow()

    expect(m?.documentVersion).toBe(4)
    const [p] = m?.pipelines ?? []
    expect(p?.status).toBe("error")
    expect(p?.error).toMatch(/boom/)
    expect(p?.artifacts).toEqual([])
  })

  // 1.6 — a `.tsx` with no synthesizable pipeline resolves with `no-pipeline`.
  it("returns status:no-pipeline for a document with no pipeline", async () => {
    const [p] = (await model("crd-no-pipeline.tsx")).pipelines
    expect(p.status).toBe("no-pipeline")
    expect(p.artifacts).toEqual([])
  })

  // The whole envelope is plain JSON (no DSL refs) so it survives the LSP wire.
  it("round-trips through JSON", async () => {
    const m = await model("dag-linear-pipeline.tsx")
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
  })
})
