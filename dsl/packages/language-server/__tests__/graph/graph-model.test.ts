import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { buildGraphModel } from "../../src/providers/graph-model"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function model(name: string, version = 7) {
  const entryPoint = join(FIXTURES, name)
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  return buildGraphModel(pathToFileURL(entryPoint).href, version, result)
}

function nodeById(m: Awaited<ReturnType<typeof model>>, id: string) {
  const n = m.nodes.find((x) => x.id === id)
  if (!n) throw new Error(`node ${id} not in [${m.nodes.map((x) => x.id)}]`)
  return n
}

function edgeSet(m: Awaited<ReturnType<typeof model>>): Set<string> {
  return new Set(m.edges.map((e) => `${e.from}->${e.to}`))
}

describe("buildGraphModel", () => {
  // 2.1 — linear fixture (Source → Filter → Sink) → 3 nodes, 2 edges
  it("projects a linear pipeline to 3 nodes / 2 edges with correct kinds", async () => {
    const m = await model("dag-linear-pipeline.tsx")

    expect(m.ok).toBe(true)
    expect(m.version).toBe(7)
    // The <Pipeline> container is excluded — only dataflow nodes remain.
    expect(m.nodes).toHaveLength(3)
    expect(m.nodes.some((n) => n.kind === "Pipeline")).toBe(false)

    expect(nodeById(m, "orders").kind).toBe("Source")
    expect(nodeById(m, "orders").component).toBe("KafkaSource")
    expect(nodeById(m, "Filter_1").kind).toBe("Transform")
    expect(nodeById(m, "sink_out").kind).toBe("Sink")
    // label = name ?? id (the sink set `name="sink_out"`; the source falls back).
    expect(nodeById(m, "sink_out").label).toBe("sink_out")
    expect(nodeById(m, "orders").label).toBe("orders")

    expect(m.edges).toHaveLength(2)
    expect(edgeSet(m)).toEqual(
      new Set(["orders->Filter_1", "Filter_1->sink_out"]),
    )
    // Longest-path layer hint runs left → right.
    expect(nodeById(m, "orders").layer).toBe(0)
    expect(nodeById(m, "Filter_1").layer).toBe(1)
    expect(nodeById(m, "sink_out").layer).toBe(2)
  })

  // 2.2 — source/sink nodes carry schema, changelogMode, statementIndices
  it("attaches schema, changelog mode, and emitted statement indices", async () => {
    const m = await model("dag-linear-pipeline.tsx")

    const source = nodeById(m, "orders")
    expect(source.schema?.map((c) => c.name)).toEqual(["order_id", "amount"])
    expect(source.schema?.[0]).toEqual({ name: "order_id", type: "BIGINT" })
    expect(source.changelogMode).toBe("append-only")
    expect(source.statementIndices.length).toBeGreaterThan(0)
    // The emitted statement at that index is the source's CREATE TABLE.
    const [idx] = source.statementIndices
    expect(m.statements[idx]).toContain("CREATE TABLE")
    expect(m.statements[idx]).toContain("orders")

    const sink = nodeById(m, "sink_out")
    expect(sink.schema && sink.schema.length).toBeGreaterThan(0)
    expect(sink.statementIndices.length).toBeGreaterThan(0)

    // A transform owns no statement (DML has no `statementOrigins` owner) and
    // resolves no output schema of its own.
    const filter = nodeById(m, "Filter_1")
    expect(filter.statementIndices).toEqual([])
    expect(filter.schema).toBeUndefined()
  })

  // 2.3 — fan-out (Route) and fan-in (Join) edge sets
  it("renders Route fan-out edges", async () => {
    const m = await model("branching-pipeline.tsx")

    // events → Route, Route → each branch wrapper, each branch → its sink.
    expect(edgeSet(m)).toEqual(
      new Set([
        "events->Route_5",
        "Route_5->Route.Branch_2",
        "Route.Branch_2->big",
        "Route_5->Route.Default_4",
        "Route.Default_4->rest",
      ]),
    )
    // The Route node fans out to both branch paths.
    const fromRoute = m.edges.filter((e) => e.from === "Route_5")
    expect(fromRoute).toHaveLength(2)
  })

  it("renders Join fan-in edges", async () => {
    const m = await model("column-join-pipeline.tsx")

    // Both sources feed the Join (via left/right), then the Join feeds the sink.
    expect(edgeSet(m)).toEqual(
      new Set(["orders->Join_2", "users->Join_2", "Join_2->out"]),
    )
    const intoJoin = m.edges.filter((e) => e.to === "Join_2")
    expect(intoJoin).toHaveLength(2)
    expect(nodeById(m, "Join_2").kind).toBe("Join")
  })

  // 2.4 — changelog-incompatible pipeline: endpoint diagnostics + crossNode edge
  it("flags the connecting edge of a cross-node changelog violation", async () => {
    const m = await model("changelog-cross-node-pipeline.tsx")

    // The diagnostic lands on the sink endpoint.
    const sink = nodeById(m, "orders_out")
    expect(sink.diagnostics.length).toBeGreaterThan(0)
    expect(sink.diagnostics[0].severity).toBe("error")
    expect(sink.diagnostics[0].category).toBe("changelog")

    // The edge between the source and sink endpoints is marked crossNode.
    const edge = m.edges.find(
      (e) => e.from === "orders" && e.to === "orders_out",
    )
    expect(edge?.crossNode).toBe(true)
    // …and it carries the upstream (retract) changelog mode.
    expect(edge?.changelogMode).toBe("retract")
  })

  it("marks no crossNode edge and no badges for a clean pipeline", async () => {
    const m = await model("dag-linear-pipeline.tsx")
    expect(m.nodes.every((n) => n.diagnostics.length === 0)).toBe(true)
    expect(m.edges.every((e) => !e.crossNode)).toBe(true)
  })

  // 2.5 — throwing pipeline → { ok: false, error }; no exception escapes
  it("returns an error envelope for a throwing pipeline without throwing", async () => {
    const entryPoint = join(FIXTURES, "throwing-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })

    let m: ReturnType<typeof buildGraphModel> | undefined
    expect(() => {
      m = buildGraphModel(pathToFileURL(entryPoint).href, 3, result)
    }).not.toThrow()

    expect(m?.ok).toBe(false)
    expect(m?.error).toMatch(/boom/)
    expect(m?.nodes).toEqual([])
    expect(m?.edges).toEqual([])
  })

  // 1.8 — the model is plain JSON (round-trips through structured clone /
  // JSON with no DSL runtime references).
  it("produces a plain-JSON-serializable model", async () => {
    const m = await model("dag-linear-pipeline.tsx")
    expect(() => JSON.parse(JSON.stringify(m))).not.toThrow()
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
  })
})
