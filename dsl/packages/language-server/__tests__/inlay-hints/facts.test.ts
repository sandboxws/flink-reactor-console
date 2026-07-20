import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { DocumentSynthState } from "../../src/document-state"
import { type NodeFactsIndex, nodeFactsFor } from "../../src/inlay-hints/facts"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"
import type { SynthesisResult } from "../../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

/** Synthesize a fixture into the per-document state the provider reads. */
async function load(name: string): Promise<DocumentSynthState> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  return { uri, version: 1, result, positionMap }
}

const idOf = (result: SynthesisResult, component: string): string => {
  const node = result.nodes.find((n) => n.component === component)
  if (!node) throw new Error(`no ${component} in synthesized nodes`)
  return node.id
}

describe("NodeFactsIndex over inlay-pipeline.tsx", () => {
  // orders/users sources → Join → Filter → TumbleWindow[Aggregate] → Map → IcebergSink
  let state: DocumentSynthState
  let facts: NodeFactsIndex
  beforeAll(async () => {
    state = await load("inlay-pipeline.tsx")
    expect(state.result.ok).toBe(true)
    const index = nodeFactsFor(state, 1)
    if (!index) throw new Error("facts unavailable for a fresh synthesis")
    facts = index
  })

  it("1.5 source facts: column count, append mode, prop-resolved parallelism", () => {
    const source = facts.getNodeFacts("orders")
    expect(source.schema.map((c) => c.name)).toEqual([
      "order_id",
      "user_id",
      "amount",
      "order_time",
    ])
    expect(source.schema[0].type).toMatch(/BIGINT/)
    expect(source.changelogMode).toBe("append-only")
    expect(source.parallelism).toEqual({ value: 4, level: "prop" })
  })

  it("1.3 window columns: the injected window_start/window_end", () => {
    const id = idOf(state.result, "TumbleWindow")
    expect(facts.getWindowColumns(id).map((c) => c.name)).toEqual([
      "window_start",
      "window_end",
    ])
    // The window's own output schema reflects the injection too.
    expect(facts.getNodeFacts(id).schema.map((c) => c.name)).toEqual([
      "user_id",
      "total",
      "window_start",
      "window_end",
    ])
  })

  it("1.3 window columns are window-only: empty for a non-window node", () => {
    expect(facts.getWindowColumns(idOf(state.result, "Filter"))).toEqual([])
  })

  it("1.4 join count: the merged (deduplicated) output column count", () => {
    // orders(4) ⋈ users(2) → 6 merged columns.
    expect(facts.getJoinColumnCount(idOf(state.result, "Join"))).toBe(6)
  })

  it("1.4 join count is join-only: undefined for a non-join node", () => {
    expect(
      facts.getJoinColumnCount(idOf(state.result, "Filter")),
    ).toBeUndefined()
  })

  it("a transform's output schema is its downstream's input (Map → sink)", () => {
    const map = facts.getNodeFacts(idOf(state.result, "Map"))
    expect(map.schema.map((c) => c.name)).toEqual(["user_id", "total"])
  })

  it("a config sub-node with no downstream yields no schema (never a guess)", () => {
    // The Aggregate nested inside the window has no dataflow edge of its own;
    // its own *input* is resolvable but is not what it emits.
    const aggregate = facts.getNodeFacts(idOf(state.result, "Aggregate"))
    expect(aggregate.schema).toEqual([])
    expect(aggregate.changelogMode).toBe("retract")
  })

  it("the Pipeline container and the catalog are not annotatable", () => {
    expect(facts.isAnnotatable(idOf(state.result, "Pipeline"))).toBe(false)
    expect(facts.isAnnotatable(idOf(state.result, "IcebergCatalog"))).toBe(
      false,
    )
    expect(facts.isAnnotatable("orders")).toBe(true)
  })
})

describe("nodeFactsFor availability marker", () => {
  it("1.5 returns the unavailable marker when synthesis trails the document version", async () => {
    const state = await load("inlay-pipeline.tsx")
    expect(nodeFactsFor(state, 1)).toBeDefined()
    expect(nodeFactsFor(state, 2)).toBeUndefined() // doc moved on mid-debounce
    expect(nodeFactsFor(undefined, 1)).toBeUndefined() // nothing synthesized yet
  })

  it("returns the unavailable marker for a failed synthesis", async () => {
    const state = await load("throwing-pipeline.tsx")
    expect(state.result.ok).toBe(false)
    expect(nodeFactsFor(state, 1)).toBeUndefined()
  })

  it("default-resolved parallelism when no Pipeline prop is set", async () => {
    const state = await load("column-window-pipeline.tsx")
    expect(state.result.parallelism).toEqual({ value: 1, level: "default" })
  })
})
