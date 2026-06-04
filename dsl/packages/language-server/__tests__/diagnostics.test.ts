import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { DiagnosticSeverity } from "vscode-languageserver"
import { mapperContext, toLspDiagnostics } from "../src/diagnostics/index"
import {
  buildPositionMap,
  type PositionMap,
} from "../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../src/synth/runner"
import type { SynthesisResult } from "../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

/** Run the full pipeline: synthesize → build position map → map to LSP. */
async function diagnose(fixture: string) {
  const entryPoint = join(FIXTURES, fixture)
  const text = readFileSync(entryPoint, "utf-8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  const lsp = toLspDiagnostics(result, mapperContext(positionMap, text, uri))
  return { result, positionMap, text, uri, lsp }
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
    edges: [],
    dagEdges: [],
    changelogModes: [],
    sinkChangelogAccepts: [],
    nodeInputSchemas: [],
    parallelism: null,
    tableSchemas: [],
    pipelineManifest: null,
    crdYaml: "",
    pipelineKind: "standard",
    artifacts: [],
    nodes: [],
    ...overrides,
  }
}

const emptyMap: PositionMap = {
  map: new Map(),
  propRanges: new Map(),
  fromLoc: false,
}

describe("diagnostics (end-to-end)", () => {
  it("publishes zero diagnostics for a valid pipeline", async () => {
    const { lsp } = await diagnose("valid-pipeline.tsx")
    expect(lsp).toEqual([])
  })

  it("maps an expression finding to the offending prop with an FR-EXPR code", async () => {
    const { lsp, positionMap } = await diagnose("validation-error-pipeline.tsx")

    expect(lsp).toHaveLength(1)
    const [diag] = lsp
    expect(diag.code).toBe("FR-EXPR-001")
    expect(diag.source).toBe("flink-reactor")
    // Narrowed to the `condition` prop value (not the whole Filter tag).
    const condition = positionMap.propRanges.get("Filter_1")?.get("condition")
    expect(condition).toBeDefined()
    expect(diag.range).toEqual(condition)
    expect(diag.range.start.line).toBeGreaterThan(0)
  })

  it("surfaces a throwing pipeline as a single FR-EVAL error", async () => {
    const { lsp } = await diagnose("throwing-pipeline.tsx")
    expect(lsp).toHaveLength(1)
    expect(lsp[0].code).toBe("FR-EVAL")
    expect(lsp[0].severity).toBe(DiagnosticSeverity.Error)
  })
})

describe("toLspDiagnostics (orchestration)", () => {
  it("falls back to the file top for an unmapped node and names it in the message", () => {
    const diag = {
      severity: "error" as const,
      message: "structural issue",
      nodeId: "ghost_99",
      category: "structure" as const,
    }
    const [lsp] = toLspDiagnostics(
      baseResult({ diagnostics: [diag] }),
      mapperContext(emptyMap, "", "file:///x.tsx"),
    )
    expect(lsp.code).toBe("FR-DAG-001")
    expect(lsp.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    })
    expect(lsp.message).toContain("ghost_99")
  })

  it("surfaces a loadError as a single FR-<KIND> error", () => {
    const lsp = toLspDiagnostics(
      baseResult({
        ok: false,
        loadError: { kind: "sql", message: "synthesis blew up" },
      }),
      mapperContext(emptyMap, "", "file:///x.tsx"),
    )
    const err = lsp.find((d) => d.code === "FR-SQL")
    expect(err).toBeDefined()
    expect(err?.severity).toBe(DiagnosticSeverity.Error)
  })

  it("emits a separate FR-MAP-MISMATCH warning when the map is approximate", () => {
    const positionMap: PositionMap = {
      map: new Map(),
      propRanges: new Map(),
      fromLoc: false,
      mismatch: {
        jsxElementCount: 2,
        constructNodeCount: 3,
        unmappedNodeIds: ["ghost_99"],
        message: "approximate",
      },
    }
    const lsp = toLspDiagnostics(
      baseResult(),
      mapperContext(positionMap, "", "file:///x.tsx"),
    )
    const mismatch = lsp.find((d) => d.code === "FR-MAP-MISMATCH")
    expect(mismatch).toBeDefined()
    expect(mismatch?.severity).toBe(DiagnosticSeverity.Warning)
  })
})
