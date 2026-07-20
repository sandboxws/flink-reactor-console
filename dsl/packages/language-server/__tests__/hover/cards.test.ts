import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import {
  buildColumnRefCard,
  buildPropCard,
  buildSinkCard,
  buildTagCard,
} from "../../src/hover/cards.js"
import { HoverFacts } from "../../src/hover/facts.js"
import { synthesizeDocument } from "../../src/synth/runner.js"
import type { SynthesisResult } from "../../src/synth/types.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const idOf = (r: SynthesisResult, component: string) => {
  const n = r.nodes.find((x) => x.component === component)
  if (!n) throw new Error(`no ${component}`)
  return n.id
}

describe("card builders (hover-pipeline.tsx)", () => {
  // KafkaSource[orders] → Filter[amount > 0] → JdbcSink
  let result: SynthesisResult
  let facts: HoverFacts
  beforeAll(async () => {
    result = await synthesizeDocument({
      entryPoint: join(FIXTURES, "hover-pipeline.tsx"),
      projectDir: FIXTURES,
    })
    facts = new HoverFacts(result)
    expect(result.ok).toBe(true)
  })

  it("buildTagCard: source shows schema + changelog + DDL + neighbors", () => {
    expect(buildTagCard(facts, idOf(result, "KafkaSource"))).toMatchSnapshot()
  })

  it("buildTagCard: transform shows the emitted WHERE + neighbors", () => {
    expect(buildTagCard(facts, idOf(result, "Filter"))).toMatchSnapshot()
  })

  it("buildSinkCard: sink shows accepted modes + compatibility + DDL/INSERT", () => {
    expect(buildSinkCard(facts, idOf(result, "JdbcSink"))).toMatchSnapshot()
  })

  it("buildColumnRefCard: a known column shows its Flink type", () => {
    expect(
      buildColumnRefCard(facts, idOf(result, "Filter"), "amount"),
    ).toMatchSnapshot()
  })

  it("buildColumnRefCard: an unknown identifier is marked, with available columns", () => {
    expect(
      buildColumnRefCard(facts, idOf(result, "Filter"), "nonexistent"),
    ).toMatchSnapshot()
  })
})

describe("prop cards (pure — no synthesis needed)", () => {
  it("buildPropCard: connector prop shows description/type/required", () => {
    expect(buildPropCard("KafkaSource", "topic")).toMatchSnapshot()
  })

  it("buildPropCard: a SQL-expression prop is marked as such", () => {
    expect(buildPropCard("Filter", "condition")).toMatchSnapshot()
  })

  it("buildPropCard: an undocumented prop returns undefined", () => {
    expect(buildPropCard("KafkaSource", "totallyUnknownProp")).toBeUndefined()
  })
})
