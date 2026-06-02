import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { DiagnosticSeverity } from "vscode-languageserver"
import { toLspDiagnostics } from "../src/diagnostics"
import {
  buildPositionMap,
  type PositionMap,
} from "../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../src/synth/runner"
import type { SynthesisResult, ValidationDiagnostic } from "../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

/** Run the full pipeline: synthesize → build position map → map to LSP. */
async function diagnose(fixture: string) {
  const entryPoint = join(FIXTURES, fixture)
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(
    readFileSync(entryPoint, "utf-8"),
    entryPoint,
    result.nodes,
  )
  return { result, positionMap, lsp: toLspDiagnostics(result, positionMap) }
}

function baseResult(overrides: Partial<SynthesisResult> = {}): SynthesisResult {
  return {
    ok: true,
    statements: [],
    sql: "",
    diagnostics: [],
    statementOrigins: [],
    statementContributors: [],
    statementMeta: [],
    pipelineManifest: null,
    crdYaml: "",
    nodes: [],
    ...overrides,
  }
}

describe("diagnostics (end-to-end)", () => {
  it("publishes zero diagnostics for a valid pipeline", async () => {
    const { lsp } = await diagnose("valid-pipeline.tsx")
    expect(lsp).toEqual([])
  })

  it("maps a validation finding to its node's source range with an FR code", async () => {
    const { lsp, positionMap } = await diagnose("validation-error-pipeline.tsx")

    expect(lsp).toHaveLength(1)
    const [diag] = lsp
    expect(diag.code).toBe("FR-EXPRESSION")
    expect(diag.source).toBe("flink-reactor")
    // The Filter node's range, not the file top.
    expect(diag.range).toEqual(positionMap.map.get("Filter_1"))
    expect(diag.range.start.line).toBeGreaterThan(0)
  })

  it("surfaces a throwing pipeline as a single FR-EVAL error", async () => {
    const { lsp } = await diagnose("throwing-pipeline.tsx")
    expect(lsp).toHaveLength(1)
    expect(lsp[0].code).toBe("FR-EVAL")
    expect(lsp[0].severity).toBe(DiagnosticSeverity.Error)
  })
})

describe("toLspDiagnostics (unit)", () => {
  // A real position map for the valid fixture so node ranges are authentic.
  async function validPositionMap(): Promise<{
    positionMap: PositionMap
    nodeIds: string[]
  }> {
    const entryPoint = join(FIXTURES, "valid-pipeline.tsx")
    const result = await synthesizeDocument({
      entryPoint,
      projectDir: FIXTURES,
    })
    const positionMap = buildPositionMap(
      readFileSync(entryPoint, "utf-8"),
      entryPoint,
      result.nodes,
    )
    return { positionMap, nodeIds: result.nodes.map((n) => n.id) }
  }

  it("codes a schema finding FR-SCHEMA at the referencing node's range", async () => {
    const { positionMap } = await validPositionMap()
    const diag: ValidationDiagnostic = {
      severity: "error",
      message: "unknown column",
      nodeId: "orders",
      category: "schema",
    }
    const [lsp] = toLspDiagnostics(
      baseResult({ diagnostics: [diag] }),
      positionMap,
    )
    expect(lsp.code).toBe("FR-SCHEMA")
    expect(lsp.severity).toBe(DiagnosticSeverity.Error)
    expect(lsp.range).toEqual(positionMap.map.get("orders"))
  })

  it("codes a connector finding FR-CONNECTOR at the right component", async () => {
    const { positionMap } = await validPositionMap()
    const diag: ValidationDiagnostic = {
      severity: "warning",
      message: "infra-provided property",
      nodeId: "print",
      category: "connector",
    }
    const [lsp] = toLspDiagnostics(
      baseResult({ diagnostics: [diag] }),
      positionMap,
    )
    expect(lsp.code).toBe("FR-CONNECTOR")
    expect(lsp.range).toEqual(positionMap.map.get("print"))
  })

  it("falls back to the file top for an unmapped node", () => {
    const diag: ValidationDiagnostic = {
      severity: "error",
      message: "structural issue",
      nodeId: "ghost_99",
      category: "structure",
    }
    const emptyMap: PositionMap = { map: new Map(), fromLoc: false }
    const [lsp] = toLspDiagnostics(
      baseResult({ diagnostics: [diag] }),
      emptyMap,
    )
    expect(lsp.code).toBe("FR-STRUCTURE")
    expect(lsp.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    })
  })

  it("emits a separate FR-MAP-MISMATCH warning when the map is approximate", () => {
    const positionMap: PositionMap = {
      map: new Map(),
      fromLoc: false,
      mismatch: {
        jsxElementCount: 2,
        constructNodeCount: 3,
        unmappedNodeIds: ["ghost_99"],
        message: "approximate",
      },
    }
    const lsp = toLspDiagnostics(baseResult(), positionMap)
    const mismatch = lsp.find((d) => d.code === "FR-MAP-MISMATCH")
    expect(mismatch).toBeDefined()
    expect(mismatch?.severity).toBe(DiagnosticSeverity.Warning)
  })
})
