import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { TEMPLATE_FACTORIES } from "@/cli/commands/new.js"
import { EXPECTED_PIPELINES } from "@/cli/templates/expected-pipelines.js"
import {
  buildTemplatesArtifact,
  type TemplatesArtifact,
  templateManifest,
} from "@/templates/manifest.js"

// `minimal` + `monorepo` are structural templates with no pipelines of their
// own; every other template ships ≥1 pipeline.
const STRUCTURAL = new Set(["minimal", "monorepo"])

describe("templateManifest", () => {
  it("returns exactly one entry per TEMPLATE_FACTORIES member (G1 drift guard)", () => {
    const manifest = templateManifest()
    const registryNames = Object.keys(TEMPLATE_FACTORIES).sort()
    const manifestNames = manifest.map((m) => m.name).sort()

    expect(manifest).toHaveLength(registryNames.length)
    expect(manifestNames).toEqual(registryNames)
  })

  it("every entry has a non-empty description and the registry's pipelines", () => {
    for (const t of templateManifest()) {
      expect(t.description.trim().length).toBeGreaterThan(0)
      expect(t.pipelines).toEqual([...EXPECTED_PIPELINES[t.name]])
      if (!STRUCTURAL.has(t.name)) {
        expect(t.pipelines.length).toBeGreaterThan(0)
      }
    }
  })

  it("derives a category and surfaces scaffold params for every entry", () => {
    for (const t of templateManifest()) {
      expect(t.category).toBeTruthy()
      expect(t.params.length).toBeGreaterThan(0)
      expect(t.params.map((p) => p.name)).toContain("projectName")
    }
  })

  it("reads requiredServices from the effective config, not the guidance comment", () => {
    const byName = new Map(templateManifest().map((m) => [m.name, m]))
    // pg-fluss-paimon depends on postgres + fluss and *not* kafka — the exact
    // case the guidance-comment landmine would get wrong.
    expect(byName.get("pg-fluss-paimon")?.requiredServices).toEqual([
      "postgres",
      "fluss",
    ])
    expect(byName.get("cdc-lakehouse")?.requiredServices).toEqual([
      "kafka",
      "iceberg",
    ])
    // Structural templates declare no services.
    expect(byName.get("minimal")?.requiredServices).toEqual([])
  })
})

describe("templates.generated.json", () => {
  const artifactPath = join(
    __dirname,
    "../../../assets/templates.generated.json",
  )

  function readArtifact(): TemplatesArtifact {
    return JSON.parse(readFileSync(artifactPath, "utf-8")) as TemplatesArtifact
  }

  it("is committed and up to date with the registry (round-trips to templateManifest())", () => {
    const parsed = readArtifact()
    expect(parsed.count).toBe(templateManifest().length)
    expect(parsed.names.slice().sort()).toEqual(
      Object.keys(TEMPLATE_FACTORIES).sort(),
    )
    // The lean `manifest` slice is exactly `templateManifest()` — a stale
    // committed artifact (registry changed without re-export) fails here.
    expect(parsed.manifest).toEqual(templateManifest())
  })

  it("carries instantiation sources with files for every template", () => {
    const parsed = readArtifact()
    for (const name of Object.keys(TEMPLATE_FACTORIES)) {
      const source = parsed.sources[name]
      expect(source, `missing sources for ${name}`).toBeDefined()
      expect((source?.files.length ?? 0) > 0).toBe(true)
    }
  })

  it("serialises and re-parses identically in memory", () => {
    const roundTripped = JSON.parse(
      JSON.stringify(buildTemplatesArtifact()),
    ) as TemplatesArtifact
    expect(roundTripped.manifest).toEqual(templateManifest())
  })
})
