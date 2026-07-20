// Per-category fixtures driven through the whole pipeline (synthesize → build
// position map → map to LSP), asserting each category's code, severity, range,
// and cross-node related information. Complements `mapper.test.ts`, which
// exercises the projection with constructed findings.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { isFlinkReactorCode } from "../../src/diagnostics/codes"
import { mapperContext, toLspDiagnostics } from "../../src/diagnostics/index"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function fullDiagnose(fixture: string): Promise<{
  lsp: Diagnostic[]
  positionMap: ReturnType<typeof buildPositionMap>
  text: string
}> {
  const entryPoint = join(FIXTURES, fixture)
  const text = readFileSync(entryPoint, "utf-8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  const lsp = toLspDiagnostics(result, mapperContext(positionMap, text, uri))
  return { lsp, positionMap, text }
}

const byCode = (lsp: Diagnostic[], prefix: string) =>
  lsp.find((d) => String(d.code).startsWith(prefix))

describe("schema (FR-SCHEMA) end-to-end", () => {
  it("flags an unknown column on the transform with a did-you-mean clause", async () => {
    const { lsp, positionMap } = await fullDiagnose("schema-typo-pipeline.tsx")
    const d = byCode(lsp, "FR-SCHEMA-")
    expect(d).toBeDefined()
    expect(d?.code).toBe("FR-SCHEMA-001")
    expect(d?.severity).toBe(DiagnosticSeverity.Error)
    expect(d?.range).toEqual(positionMap.map.get("Filter_1"))
    expect(d?.message).toContain("did you mean `amount`?")
  })
})

describe("connector (FR-CONN) end-to-end", () => {
  it("names the missing conditional prop on the component", async () => {
    const { lsp } = await fullDiagnose("connector-missing-prop-pipeline.tsx")
    const d = byCode(lsp, "FR-CONN-")
    expect(d).toBeDefined()
    expect(d?.code).toBe("FR-CONN-001")
    expect(d?.message).toContain("schemaRegistryUrl")
  })
})

describe("changelog (FR-CDC) end-to-end", () => {
  it("places one cross-node diagnostic on the sink linking the source", async () => {
    const { lsp, positionMap } = await fullDiagnose(
      "changelog-cross-node-pipeline.tsx",
    )
    const cdc = lsp.filter((d) => String(d.code).startsWith("FR-CDC-"))
    expect(cdc).toHaveLength(1)
    const [d] = cdc
    // Primary range on the sink endpoint.
    expect(d.range).toEqual(positionMap.map.get("orders_out"))
    // Related-information link back to the source endpoint.
    expect(d.relatedInformation).toHaveLength(1)
    expect(d.relatedInformation?.[0].location.range).toEqual(
      positionMap.map.get("orders"),
    )
  })
})

describe("structure (FR-DAG) end-to-end", () => {
  it("flags the orphan source", async () => {
    const { lsp, positionMap } = await fullDiagnose(
      "orphan-source-pipeline.tsx",
    )
    const d = byCode(lsp, "FR-DAG-")
    expect(d).toBeDefined()
    expect(d?.code).toBe("FR-DAG-001")
    expect(d?.message).toContain("lonely")
    expect(d?.range).toEqual(positionMap.map.get("lonely"))
  })
})

describe("FR-only guarantee across fixtures (task 9.3)", () => {
  it("every published code is FR-prefixed and never the ts-plugin nesting code", async () => {
    const fixtures = [
      "schema-typo-pipeline.tsx",
      "connector-missing-prop-pipeline.tsx",
      "changelog-cross-node-pipeline.tsx",
      "orphan-source-pipeline.tsx",
      "validation-error-pipeline.tsx",
    ]
    for (const fixture of fixtures) {
      const { lsp } = await fullDiagnose(fixture)
      expect(lsp.length).toBeGreaterThan(0)
      for (const d of lsp) {
        expect(isFlinkReactorCode(d.code)).toBe(true)
        expect(d.code).not.toBe("90100")
      }
    }
  })
})
