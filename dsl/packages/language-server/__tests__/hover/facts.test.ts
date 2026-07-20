import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import { HoverFacts } from "../../src/hover/facts.js"
import { synthesizeDocument } from "../../src/synth/runner.js"
import type { SynthesisResult } from "../../src/synth/types.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const entry = (name: string) => ({
  entryPoint: join(FIXTURES, name),
  projectDir: FIXTURES,
})

/** First node id of a given component in the synthesized tree. */
const idOf = (result: SynthesisResult, component: string): string => {
  const node = result.nodes.find((n) => n.component === component)
  if (!node) throw new Error(`no ${component} in synthesized nodes`)
  return node.id
}

describe("HoverFacts over a linear pipeline (valid-pipeline.tsx)", () => {
  // KafkaSource[orders] → Filter[amount > 100] → Map → GenericSink[print]
  let result: SynthesisResult
  let facts: HoverFacts
  beforeAll(async () => {
    result = await synthesizeDocument(entry("valid-pipeline.tsx"))
    facts = new HoverFacts(result)
    expect(result.ok).toBe(true)
  })

  it("getNodeSchema: source columns + append-only changelog mode", () => {
    const schema = facts.getNodeSchema(idOf(result, "KafkaSource"))
    expect(schema.columns.map((c) => c.name)).toEqual([
      "order_id",
      "amount",
      "order_time",
    ])
    expect(schema.columns[0].type).toMatch(/BIGINT/)
    expect(schema.changelogMode).toBe("append-only")
  })

  it("getEmittedFragment: a Filter contributes the WHERE predicate", () => {
    const emitted = facts.getEmittedFragment(idOf(result, "Filter"))
    const text = emitted.fragments.join("\n")
    expect(text).toContain("WHERE")
    expect(text).toContain("amount > 100")
  })

  it("getEmittedFragment: the sink heads the INSERT INTO DML + owns its DDL", () => {
    const emitted = facts.getEmittedFragment(idOf(result, "GenericSink"))
    expect(emitted.owned.join("\n")).toContain("CREATE TABLE")
    expect(emitted.dml.join("\n")).toContain("INSERT INTO")
  })

  it("getNeighbors: linear chain links upstream + downstream", () => {
    const nb = facts.getNeighbors(idOf(result, "Filter"))
    expect(nb.upstream.map((n) => n.label)).toContain("KafkaSource")
    expect(nb.downstream.map((n) => n.label)).toContain("Map")
  })

  it("getUpstreamSchema: types a column from the feeding source schema", () => {
    const cols = facts.getUpstreamSchema(idOf(result, "Filter"))
    expect(cols.find((c) => c.name === "amount")?.type).toMatch(/DECIMAL/)
  })
})

describe("HoverFacts over a branching pipeline (branching-pipeline.tsx)", () => {
  it("getNeighbors: a fan-out source has downstream neighbors", async () => {
    const result = await synthesizeDocument(entry("branching-pipeline.tsx"))
    expect(result.ok).toBe(true)
    const facts = new HoverFacts(result)
    const nb = facts.getNeighbors(idOf(result, "KafkaSource"))
    expect(nb.downstream.length).toBeGreaterThan(0)
  })
})

describe("HoverFacts over a changelog-capable sink (hover-pipeline.tsx)", () => {
  // KafkaSource[orders] → Filter[amount > 0] → JdbcSink (changelog-capable)
  let result: SynthesisResult
  let facts: HoverFacts
  beforeAll(async () => {
    result = await synthesizeDocument(entry("hover-pipeline.tsx"))
    facts = new HoverFacts(result)
    expect(result.ok).toBe(true)
  })

  it("getSinkAccepts: JdbcSink accepts retract/upsert", () => {
    const accepts = facts.getSinkAccepts(idOf(result, "JdbcSink"))
    expect(accepts).toContain("retract")
    expect(accepts).toContain("upsert")
  })

  it("the sink's incoming changelog mode is append-only (json source, passthrough)", () => {
    expect(facts.getNodeSchema(idOf(result, "JdbcSink")).changelogMode).toBe(
      "append-only",
    )
  })

  it("the sink owns its DDL and heads the INSERT INTO DML", () => {
    const emitted = facts.getEmittedFragment(idOf(result, "JdbcSink"))
    expect(emitted.owned.join("\n")).toContain("CREATE TABLE")
    expect(emitted.dml.join("\n")).toContain("INSERT INTO")
  })
})
