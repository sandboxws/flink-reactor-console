// The `flinkReactor/tapManifest` projector (tap-visualization, tasks 2.1–2.7):
// tap shape + identity, schema normalization, autoTap stamping, the null
// (no-taps) case, synthesis failure, consoleUrl passthrough, and the
// plain-JSON / no-`connectorProperties` transport guarantee.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import type { DocumentSynthState } from "../../src/document-state"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { buildTapManifestModel } from "../../src/providers/tap-manifest"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function load(name: string): Promise<DocumentSynthState> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  return { uri, version: 1, result, positionMap }
}

describe("flinkReactor/tapManifest projector", () => {
  // 2.1 — explicit taps carry identity, names, consumer group, and SQL.
  it("projects explicit taps with nodeId identity and observation SQL", async () => {
    const state = await load("tap-pipeline.tsx")
    const model = buildTapManifestModel(state, state.uri, 1, undefined)

    expect(model.ok).toBe(true)
    expect(model.pipelineName).toBe("tap-pipeline")
    expect(model.flinkVersion).toBeDefined()
    expect(model.generatedAt).toBeDefined()

    const source = model.taps.find((t) => t.componentName === "KafkaSource")
    const filter = model.taps.find((t) => t.componentName === "Filter")
    expect(source).toBeDefined()
    expect(filter).toBeDefined()
    if (!source || !filter) return

    // Tap identity is the ConstructNode.id — it must join the synthesis
    // result's node list (the DAG model / source map identity).
    const nodeIds = new Set(state.result.nodes.map((n) => n.id))
    expect(nodeIds.has(source.nodeId)).toBe(true)
    expect(nodeIds.has(filter.nodeId)).toBe(true)

    expect(filter.name).toBe("filtered-orders")
    expect(source.connectorType).toBe("kafka")
    expect(source.consumerGroupId.length).toBeGreaterThan(0)
    expect(source.observationSql).toContain("CREATE TEMPORARY TABLE")
  })

  // 2.2 — schema normalized from the manifest's Record<string,string>.
  it("carries the tapped schema as ordered {name,type} columns", async () => {
    const state = await load("tap-pipeline.tsx")
    const model = buildTapManifestModel(state, state.uri, 1, undefined)
    const source = model.taps.find((t) => t.componentName === "KafkaSource")
    expect(source?.schema).toEqual([
      { name: "order_id", type: "BIGINT" },
      { name: "amount", type: "DECIMAL(10, 2)" },
    ])
  })

  // 2.3 — the untapped sink is dev-mode auto-tapped; explicit taps are not.
  it("distinguishes dev-mode auto-taps from explicit taps", async () => {
    const state = await load("tap-pipeline.tsx")
    const model = buildTapManifestModel(state, state.uri, 1, undefined)

    const sink = model.taps.find((t) => t.componentName === "KafkaSink")
    expect(sink?.autoTap).toBe(true)
    const explicit = model.taps.filter((t) => t.componentName !== "KafkaSink")
    expect(explicit.length).toBe(2)
    for (const tap of explicit) expect(tap.autoTap).toBe(false)
  })

  // 2.4 — tapManifest === null (no taps, no sinks) → ok with empty taps.
  it("maps a null manifest to ok with empty taps", async () => {
    const state = await load("tap-none-pipeline.tsx")
    expect(state.result.tapManifest).toBeNull()
    const model = buildTapManifestModel(state, state.uri, 1, undefined)
    expect(model.ok).toBe(true)
    expect(model.error).toBeUndefined()
    expect(model.taps).toEqual([])
  })

  // 2.5 — a throwing pipeline degrades to ok:false + error, no exception.
  it("returns ok:false with the load error for a throwing pipeline", async () => {
    const state = await load("throwing-pipeline.tsx")
    const model = buildTapManifestModel(state, state.uri, 1, undefined)
    expect(model.ok).toBe(false)
    expect(model.error).toBeDefined()
    expect(model.taps).toEqual([])
  })

  // 2.6 — consoleUrl passthrough: configured → present; unset → omitted.
  it("includes the configured consoleUrl and omits it when unset", async () => {
    const state = await load("tap-pipeline.tsx")
    const withUrl = buildTapManifestModel(
      state,
      state.uri,
      1,
      "http://localhost:4400",
    )
    expect(withUrl.consoleUrl).toBe("http://localhost:4400")

    const without = buildTapManifestModel(state, state.uri, 1, undefined)
    expect("consoleUrl" in without).toBe(false)
  })

  // 2.7 — the payload is plain JSON and never leaks connectorProperties.
  it("is plain JSON with no connectorProperties", async () => {
    const state = await load("tap-pipeline.tsx")
    const model = buildTapManifestModel(state, state.uri, 1, undefined)
    // Round-trips losslessly through JSON — no class instances, no functions.
    expect(JSON.parse(JSON.stringify(model))).toEqual(model)
    expect(JSON.stringify(model)).not.toContain("connectorProperties")
    for (const tap of model.taps) {
      expect("connectorProperties" in tap).toBe(false)
      // Config values are flattened to strings (plain transport shape).
      for (const value of Object.values(tap.config)) {
        expect(typeof value).toBe("string")
      }
    }
  })

  // An un-synthesized document resolves with a failure envelope, not a throw.
  it("returns a failure envelope when no state is held", () => {
    const model = buildTapManifestModel(
      undefined,
      "file:///x.tsx",
      7,
      undefined,
    )
    expect(model).toEqual({
      uri: "file:///x.tsx",
      version: 7,
      ok: false,
      error: "Pipeline has not been synthesized yet.",
      taps: [],
    })
  })
})
