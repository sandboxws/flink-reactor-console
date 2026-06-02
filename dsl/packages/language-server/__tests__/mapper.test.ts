import { describe, expect, it } from "vitest"
import { IdPredictor } from "../src/mappers/id-predictor"
import { buildPositionMap } from "../src/mappers/source-position-mapper"
import type { NodeProjection } from "../src/synth/types"

describe("IdPredictor", () => {
  it("mirrors the DSL counter + name-hint scheme", () => {
    const p = new IdPredictor()
    // Mirrors valid-pipeline creation (post-order): source, filter, map, sink, pipeline.
    expect(p.predict("KafkaSource", { topic: "orders" })).toBe("orders")
    expect(p.predict("Filter", {})).toBe("Filter_1")
    expect(p.predict("Map", {})).toBe("Map_2")
    expect(p.predict("GenericSink", { connector: "print" })).toBe("print")
    expect(p.predict("Pipeline", { name: "p" })).toBe("Pipeline_4")
  })

  it("dedupes repeated name-derived ids", () => {
    const p = new IdPredictor()
    expect(p.predict("KafkaSink", { topic: "out" })).toBe("out")
    expect(p.predict("GenericSink", { connector: "out" })).toBe("out_2")
  })

  it("ignores `name` on components that don't derive from it", () => {
    const p = new IdPredictor()
    // Filter never reads `name` in the DSL → still counter-based.
    expect(p.predict("Filter", { name: "ignored" })).toBe("Filter_0")
  })
})

describe("buildPositionMap", () => {
  const FILE = "pipeline.tsx"

  it("maps a single-component pipeline (Pipeline + KafkaSource)", () => {
    const src = [
      "export default (",
      '  <Pipeline name="p">',
      '    <KafkaSource topic="orders" />',
      "  </Pipeline>",
      ")",
    ].join("\n")
    const nodes: NodeProjection[] = [
      { id: "orders", component: "KafkaSource", kind: "Source" },
      { id: "Pipeline_1", component: "Pipeline", kind: "Pipeline" },
    ]

    const { map, mismatch } = buildPositionMap(src, FILE, nodes)
    expect(mismatch).toBeUndefined()
    expect(map.has("orders")).toBe(true)
    expect(map.has("Pipeline_1")).toBe(true)
    // The KafkaSource range points at its own line.
    expect(map.get("orders")?.start.line).toBe(2)
  })

  it("reports a mismatch when synthesis produces an unmappable node", () => {
    const src = [
      'export default (<Pipeline name="p"><KafkaSource topic="orders" /></Pipeline>)',
    ].join("\n")
    const nodes: NodeProjection[] = [
      { id: "orders", component: "KafkaSource", kind: "Source" },
      { id: "Pipeline_1", component: "Pipeline", kind: "Pipeline" },
      // A node with no corresponding JSX element (e.g. programmatic createElement).
      { id: "ghost_99", component: "Filter", kind: "Transform" },
    ]

    const { map, mismatch } = buildPositionMap(src, FILE, nodes)
    expect(map.has("orders")).toBe(true)
    expect(mismatch).toBeDefined()
    expect(mismatch?.unmappedNodeIds).toEqual(["ghost_99"])
  })

  it("uses the __loc fast-path when every node carries a range", () => {
    const loc = {
      start: { line: 3, character: 4 },
      end: { line: 3, character: 20 },
    }
    const nodes: NodeProjection[] = [
      { id: "a", component: "KafkaSource", kind: "Source", loc },
    ]
    const { map, fromLoc } = buildPositionMap("// ignored", FILE, nodes)
    expect(fromLoc).toBe(true)
    expect(map.get("a")).toEqual(loc)
  })
})
