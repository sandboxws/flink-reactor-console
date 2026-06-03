import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { cacheKeyFor, computeCacheKey, ResultCache } from "../src/synth/cache"
import { synthesizeDocument } from "../src/synth/runner"
import type { SynthesisResult } from "../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

function entry(name: string) {
  return { entryPoint: join(FIXTURES, name), projectDir: FIXTURES }
}

describe("synthesizeDocument", () => {
  it("synthesizes a valid pipeline", async () => {
    const result = await synthesizeDocument(entry("valid-pipeline.tsx"))

    expect(result.ok).toBe(true)
    expect(result.loadError).toBeUndefined()
    expect(result.statements.length).toBeGreaterThan(0)
    expect(result.sql).toContain("CREATE TABLE")
    expect(result.sql).toContain("INSERT INTO")
    expect(result.crdYaml).toContain("kind:")

    // KafkaSource derives its id from `topic` → "orders".
    const ids = result.statementOrigins.map((o) => o.nodeId)
    expect(ids).toContain("orders")
    // The construct tree was projected for the mapper.
    expect(result.nodes.some((n) => n.component === "Pipeline")).toBe(true)
  })

  it("yields a load-error diagnostic for a throwing pipeline and does not crash", async () => {
    const broken = await synthesizeDocument(entry("throwing-pipeline.tsx"))

    expect(broken.ok).toBe(false)
    expect(broken.loadError?.kind).toBe("eval")
    expect(broken.loadError?.message).toMatch(/boom/)

    // The process is still healthy: a subsequent valid synth succeeds.
    const ok = await synthesizeDocument(entry("valid-pipeline.tsx"))
    expect(ok.ok).toBe(true)
  })

  it("invokes a function default export (resolution tier 2)", async () => {
    const result = await synthesizeDocument(entry("fn-default-pipeline.tsx"))

    expect(result.ok).toBe(true)
    expect(result.pipelineManifest?.pipelineName).toBe("fn-default-pipeline")
  })
})

describe("ResultCache", () => {
  function fakeResult(sql: string): SynthesisResult {
    return {
      ok: true,
      statements: [sql],
      sql,
      diagnostics: [],
      statementOrigins: [],
      statementContributors: [],
      statementMeta: [],
      edges: [],
      dagEdges: [],
      changelogModes: [],
      sinkChangelogAccepts: [],
      nodeInputSchemas: [],
      tableSchemas: [],
      pipelineManifest: null,
      crdYaml: "",
      pipelineKind: "standard",
      artifacts: [],
      nodes: [],
    }
  }

  it("returns a cached result for the same key (cache hit skips re-synthesis)", () => {
    const cache = new ResultCache()
    const key = "k1"
    expect(cache.get(key)).toBeUndefined()
    cache.set(key, fakeResult("SELECT 1"))
    expect(cache.get(key)?.sql).toBe("SELECT 1")
  })

  it("computes a stable key that changes with document text", () => {
    const a = computeCacheKey({
      documentText: "X",
      configMtimeMs: 0,
      aliasTarget: "/p",
    })
    const a2 = computeCacheKey({
      documentText: "X",
      configMtimeMs: 0,
      aliasTarget: "/p",
    })
    const b = computeCacheKey({
      documentText: "Y",
      configMtimeMs: 0,
      aliasTarget: "/p",
    })
    expect(a).toBe(a2)
    expect(a).not.toBe(b)
  })

  it("derives a key from a document + project", () => {
    const k1 = cacheKeyFor("source A", FIXTURES)
    const k2 = cacheKeyFor("source B", FIXTURES)
    expect(k1).not.toBe(k2)
  })

  it("evicts oldest entries past the cap", () => {
    const cache = new ResultCache(2)
    cache.set("a", fakeResult("a"))
    cache.set("b", fakeResult("b"))
    cache.set("c", fakeResult("c"))
    expect(cache.has("a")).toBe(false)
    expect(cache.has("b")).toBe(true)
    expect(cache.has("c")).toBe(true)
  })
})
