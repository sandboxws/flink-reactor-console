// Classifier parity test over the fixture matrix (visual-designer task 2.7):
// literal, identifier, member access, computed/element access, call, arrow,
// interpolated template, literal array, and spread — each prop's
// classification is asserted against REAL synthesis output, so the pairing
// (IdPredictor) and the classification stay honest together.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { DesignerPropEntry } from "../../src/designer/model.js"
import { classifyNodeProps } from "../../src/designer/prop-classifier.js"
import { buildDesignerModel } from "../../src/providers/designer-model.js"
import { synthesizeDocument } from "../../src/synth/runner.js"
import type { SynthesisResult } from "../../src/synth/types.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const FIXTURE = join(FIXTURES, "designer-classifier-pipeline.tsx")

let cached: { result: SynthesisResult; text: string } | undefined
async function synthFixture(): Promise<{
  result: SynthesisResult
  text: string
}> {
  if (!cached) {
    const result = await synthesizeDocument({
      entryPoint: FIXTURE,
      projectDir: FIXTURES,
    })
    cached = { result, text: readFileSync(FIXTURE, "utf8") }
  }
  return cached
}

function entriesFor(
  result: SynthesisResult,
  text: string,
  component: string,
): ReadonlyMap<string, DesignerPropEntry> {
  const node = result.nodes.find((n) => n.component === component)
  expect(node, `synthesis should produce a ${component} node`).toBeDefined()
  const classified = classifyNodeProps(text, FIXTURE, result.nodes)
  const entries = classified.get(node?.id ?? "")
  expect(entries, `${component} should pair to a JSX element`).toBeDefined()
  return new Map((entries ?? []).map((e) => [e.name, e]))
}

describe("prop classifier (fixture matrix)", () => {
  it("classifies literal props editable with value + range", async () => {
    const { result, text } = await synthFixture()
    const source = entriesFor(result, text, "KafkaSource")

    const topic = source.get("topic")
    expect(topic?.classification).toBe("editable")
    expect(topic?.value).toBe("orders")
    expect(topic?.valueKind).toBe("string")
    expect(topic?.range).toBeDefined()

    const filter = entriesFor(result, text, "Filter")
    expect(filter.get("condition")?.classification).toBe("editable")
    expect(filter.get("condition")?.value).toBe("amount > 0")
    expect(filter.get("parallelism")?.classification).toBe("editable")
    expect(filter.get("parallelism")?.value).toBe(2)
    expect(filter.get("parallelism")?.valueKind).toBe("number")
  })

  it("classifies a literal array editable and a bare/false boolean editable", async () => {
    const { result, text } = await synthFixture()
    const source = entriesFor(result, text, "KafkaSource")

    const pk = source.get("primaryKey")
    expect(pk?.classification).toBe("editable")
    expect(pk?.value).toEqual(["id"])
    expect(pk?.valueKind).toBe("array")

    const tap = source.get("tap")
    expect(tap?.classification).toBe("editable")
    expect(tap?.value).toBe(false)
    expect(tap?.valueKind).toBe("boolean")
  })

  it("classifies identifier / member / computed / call / arrow / template props readOnly", async () => {
    const { result, text } = await synthFixture()
    const source = entriesFor(result, text, "KafkaSource")

    expect(source.get("schema")?.classification).toBe("readOnly") // identifier
    expect(source.get("bootstrapServers")?.classification).toBe("readOnly") // member
    expect(source.get("format")?.classification).toBe("readOnly") // computed
    expect(source.get("consumerGroup")?.classification).toBe("readOnly") // call
    expect(source.get("schemaRegistryUrl")?.classification).toBe("readOnly") // template

    const filter = entriesFor(result, text, "Filter")
    expect(filter.get("debug")?.classification).toBe("readOnly") // arrow

    // readOnly entries carry no value and no range.
    expect(source.get("schema")?.value).toBeUndefined()
    expect(source.get("schema")?.range).toBeUndefined()
  })

  it("a spread contributes no editable entry", async () => {
    const { result, text } = await synthFixture()
    const sink = entriesFor(result, text, "GenericSink")
    // The spread itself is invisible; only the explicit attributes appear.
    expect([...sink.keys()].sort()).toEqual(["connector", "name"])
    expect(sink.get("connector")?.classification).toBe("editable")
  })

  it("designer model is plain JSON and marks the fixture arbitrary", async () => {
    const { result, text } = await synthFixture()
    const model = buildDesignerModel("file:///x.tsx", 1, result, text)

    expect(model.ok).toBe(true)
    expect(model.fileKind).toBe("arbitrary") // no designer pragma
    expect(model.fileKindReason).toMatch(/designer-managed/)
    // Round-trips through JSON unchanged → no DSL objects/Maps/functions leak.
    expect(JSON.parse(JSON.stringify(model))).toEqual(model)
    // The superset keeps graph parity: every node carries a props array.
    expect(model.nodes.length).toBeGreaterThan(0)
    for (const node of model.nodes) {
      expect(Array.isArray(node.props)).toBe(true)
    }
  })
})
