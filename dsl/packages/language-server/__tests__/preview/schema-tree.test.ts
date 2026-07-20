import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import type { DocumentSynthState } from "../../src/document-state"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { buildSchemaTreeModel } from "../../src/providers/schema-tree"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

/** Synthesize a fixture into the per-document state the builder reads. */
async function model(name: string) {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  const state: DocumentSynthState = { uri, version: 7, result, positionMap }
  return { uri, text, response: buildSchemaTreeModel(state, text) }
}

describe("buildSchemaTreeModel", () => {
  // 5.5 — sources and sinks are listed with their fields, and primary-key
  // fields are marked.
  it("projects sources and sinks with fields and primary-key marking", async () => {
    const { response, uri } = await model("def-schema-tree-pipeline.tsx")
    expect(response.ok).toBe(true)
    expect(response.uri).toBe(uri)
    expect(response.version).toBe(7)

    const source = response.tables.find((t) => t.role === "source")
    const sink = response.tables.find((t) => t.role === "sink")
    expect(source?.component).toBe("KafkaSource")
    expect(sink?.component).toBe("GenericSink")

    const names = source?.fields.map((f) => f.name)
    expect(names).toEqual(["event_id", "user_id", "event_time"])
    const pk = source?.fields.find((f) => f.name === "event_id")
    expect(pk?.primaryKey).toBe(true)
    expect(source?.fields.find((f) => f.name === "user_id")?.primaryKey).toBe(
      false,
    )

    // The sink writes the inferred input schema (it carries the source columns
    // through the Filter).
    expect(sink?.fields.map((f) => f.name)).toContain("event_id")
  })

  // 5.5 — a source's watermark is reported with its column and expression.
  it("reports the watermark for a source that declares one", async () => {
    const { response } = await model("def-schema-tree-pipeline.tsx")
    const source = response.tables.find((t) => t.role === "source")
    expect(source?.watermark).toEqual({
      column: "event_time",
      expression: "event_time - INTERVAL '5' SECOND",
    })
    // A sink writes a stream, so it never reports a watermark.
    expect(
      response.tables.find((t) => t.role === "sink")?.watermark,
    ).toBeUndefined()
  })

  // 5.5 — each entry carries a locationRef (node JSX); inline source fields
  // carry a field-key locationRef into the same file.
  it("attaches locationRefs for nodes and inline source fields", async () => {
    const { response, uri } = await model("def-schema-tree-pipeline.tsx")
    const source = response.tables.find((t) => t.role === "source")
    expect(source?.locationRef?.uri).toBe(uri)
    const field = source?.fields.find((f) => f.name === "event_id")
    expect(field?.locationRef?.uri).toBe(uri)
  })

  // 5.5 — a field whose schema lives in `schemas/orders.ts` carries a
  // cross-file locationRef.
  it("attaches a cross-file locationRef for an imported schema field", async () => {
    const { response } = await model("def-xfile-pipeline.tsx")
    const source = response.tables.find((t) => t.role === "source")
    const field = source?.fields.find((f) => f.name === "o_orderkey")
    expect(field?.locationRef?.uri).toBe(
      pathToFileURL(join(FIXTURES, "schemas", "orders.ts")).href,
    )
  })

  // 5.5 — a synthesis failure yields an error response, not a throw.
  it("returns an error response when synthesis fails", async () => {
    const { response } = await model("throwing-pipeline.tsx")
    expect(response.ok).toBe(false)
    expect(response.error).toBeDefined()
    expect(response.tables).toEqual([])
  })
})
