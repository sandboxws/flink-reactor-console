// scaffold → validate → synth → determinism → graph, per template.
// One scaffold + install per template (beforeAll), many assertions.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DEFAULT_TEMPLATES } from "./helpers/templates.js"
import {
  createE2eContext,
  type E2eContext,
  type E2eProject,
  type JsonEnvelope,
} from "./helpers/test-context.js"

interface DeploymentYaml {
  readonly kind: string
  readonly metadata: { readonly name: string }
}

describe.each(DEFAULT_TEMPLATES)("template $template", ({
  template,
  pipelines,
}) => {
  let ctx: E2eContext
  let project: E2eProject

  beforeAll(async () => {
    ctx = createE2eContext()
    project = await ctx.scaffold(template)
  }, 600_000)

  afterAll(() => {
    ctx.cleanupAll()
  })

  it("scaffolds the expected project skeleton", () => {
    expect(existsSync(join(project.dir, "package.json"))).toBe(true)
    expect(existsSync(join(project.dir, "tsconfig.json"))).toBe(true)
    if (pipelines.length > 0) {
      expect(existsSync(join(project.dir, "pipelines"))).toBe(true)
    }
  })

  it("validate exits 0", async () => {
    const result = await project.validate()

    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
    if (pipelines.length === 0) {
      expect(result.stdout.toLowerCase()).toContain("no pipelines found")
    }
  })

  it("validate --json emits an ok envelope", async () => {
    const { result, envelope } = await project.runJson(["validate"])

    expect(result.exitCode).toBe(0)
    expect(envelope.formatVersion).toBe(1)
    expect(envelope.command).toBe("validate")
    expect(envelope.ok).toBe(true)
    expect(envelope.pipelines.map((p) => p.name).sort()).toEqual([...pipelines])
  })

  it("synth exits 0 and writes the full artifact set", async () => {
    const result = await project.synth()

    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
    for (const name of pipelines) {
      const sql = project.readFile(`dist/${name}/pipeline.sql`)
      const isPipelineConnector = existsSync(
        join(project.dir, "dist", name, "pipeline.yaml"),
      )
      if (isPipelineConnector) {
        expect(sql).toContain("PIPELINE CONNECTOR")
      } else {
        expect(sql).toContain("CREATE TABLE")
        expect(sql).toContain("INSERT INTO")
        expect(
          existsSync(join(project.dir, "dist", name, "configmap.yaml")),
        ).toBe(true)
      }

      const deployment = project.readYaml<DeploymentYaml>(
        `dist/${name}/deployment.yaml`,
      )
      expect(deployment.kind).toBe("FlinkDeployment")
      expect(deployment.metadata.name).toBe(name)

      const tapManifestPath = join(
        project.dir,
        "dist",
        `${name}.tap-manifest.json`,
      )
      if (existsSync(tapManifestPath)) {
        const manifest = project.readJson<{ taps: unknown[] }>(
          `dist/${name}.tap-manifest.json`,
        )
        expect(manifest.taps.length).toBeGreaterThan(0)
      }
    }
  })

  it("synth --json reports every written file", async () => {
    const { result, envelope } = await project.runJson([
      "synth",
      "-o",
      "dist-json",
    ])

    expect(result.exitCode).toBe(0)
    expect(envelope.command).toBe("synth")
    expect(envelope.ok).toBe(true)
    expect(envelope.pipelines).toHaveLength(pipelines.length)
    for (const pipeline of envelope.pipelines as ReadonlyArray<{
      files: ReadonlyArray<{ path: string }>
      statementCount: number
    }>) {
      expect(pipeline.statementCount).toBeGreaterThan(0)
      for (const file of pipeline.files) {
        expect(existsSync(file.path), file.path).toBe(true)
      }
    }
  })

  // Core value proposition: same input → byte-identical output.
  // The tap manifest's `generatedAt` is the ONLY field permitted to
  // differ between runs (docs/contributors/specs/tap-resolution.md
  // TAP-7; statement-ordering.md ORD-5).
  it("synth is byte-deterministic across runs (TAP-7, ORD-5)", async () => {
    if (pipelines.length === 0) return

    const first = await project.synth(["-o", "dist-a"])
    const second = await project.synth(["-o", "dist-b"])
    expect(first.exitCode).toBe(0)
    expect(second.exitCode).toBe(0)

    const a = project.snapshotOutdir("dist-a")
    const b = project.snapshotOutdir("dist-b")
    expect([...a.keys()]).toEqual([...b.keys()])

    for (const [path, contentA] of a) {
      const contentB = b.get(path) as string
      if (path.endsWith(".tap-manifest.json")) {
        const parsedA = JSON.parse(contentA) as Record<string, unknown>
        const parsedB = JSON.parse(contentB) as Record<string, unknown>
        delete parsedA.generatedAt
        delete parsedB.generatedAt
        expect(parsedA, path).toEqual(parsedB)
      } else {
        expect(contentB, path).toBe(contentA)
      }
    }
  })

  it("graph -f dot emits a digraph", async () => {
    if (pipelines.length === 0) return

    const result = await project.graph("dot")

    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain("digraph")
  })
})

// Type-only usage keeps the import honest if assertions move around.
type _EnvelopeCheck = JsonEnvelope
