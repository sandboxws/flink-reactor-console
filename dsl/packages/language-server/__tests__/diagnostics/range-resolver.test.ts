import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { MapperContext } from "../../src/diagnostics/index"
import {
  FILE_TOP_RANGE,
  findTagByText,
  resolveRange,
} from "../../src/diagnostics/range-resolver"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"
import type { ValidationDiagnostic } from "../../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

let ctx: MapperContext

beforeAll(async () => {
  const entryPoint = join(FIXTURES, "valid-pipeline.tsx")
  const text = readFileSync(entryPoint, "utf-8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  ctx = { positionMap, sourceText: text, uri: pathToFileURL(entryPoint).href }
})

describe("resolveRange", () => {
  it("places a finding at the full element span by default (tag placement)", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "structural",
      nodeId: "orders",
      component: "KafkaSource",
      category: "structure",
    }
    const { range, fellBackToFileTop } = resolveRange(finding, ctx)
    expect(fellBackToFileTop).toBe(false)
    expect(range).toEqual(ctx.positionMap.map.get("orders"))
  })

  it("narrows an expression finding to the implicated prop value", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message:
        "Filter 'Filter_1' has invalid SQL syntax in condition: parse error",
      nodeId: "Filter_1",
      component: "Filter",
      category: "expression",
    }
    const { range } = resolveRange(finding, ctx)
    const condition = ctx.positionMap.propRanges
      .get("Filter_1")
      ?.get("condition")
    expect(condition).toBeDefined()
    expect(range).toEqual(condition)
    // Narrowed range sits strictly inside the element, not on the tag.
    expect(range).not.toEqual(ctx.positionMap.map.get("Filter_1"))
  })

  it("falls back to a text search for the component tag when the node is unmapped", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "unmapped",
      nodeId: "ghost_404",
      component: "KafkaSource",
      category: "connector",
    }
    const { range, fellBackToFileTop } = resolveRange(finding, ctx)
    expect(fellBackToFileTop).toBe(false)
    // The text search points at the `<KafkaSource` line in the fixture.
    expect(ctx.sourceText.split("\n")[range.start.line]).toContain(
      "KafkaSource",
    )
  })

  it("falls back to the file top when the node and tag cannot be located", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "totally unmapped",
      nodeId: "ghost_404",
      category: "structure",
    }
    const { range, fellBackToFileTop } = resolveRange(finding, ctx)
    expect(fellBackToFileTop).toBe(true)
    expect(range).toEqual(FILE_TOP_RANGE)
  })
})

describe("findTagByText", () => {
  it("locates a dot-notation component tag", () => {
    const src = '  <Route.Branch condition="x > 1">\n'
    const range = findTagByText(src, "Route.Branch")
    expect(range).toBeDefined()
    expect(range?.start.character).toBe(3) // after the leading `  <`
  })

  it("returns undefined when the tag is absent", () => {
    expect(findTagByText("const x = 1", "KafkaSource")).toBeUndefined()
  })
})
