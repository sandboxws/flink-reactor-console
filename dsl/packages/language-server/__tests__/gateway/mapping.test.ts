import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import {
  DIAGNOSTIC_CODE_TABLE,
  DIAGNOSTIC_SOURCE,
} from "../../src/diagnostics/codes"
import type { DocumentSynthState } from "../../src/document-state"
import {
  GATEWAY_CODE_PREFIX,
  GATEWAY_DIAGNOSTIC_SOURCE,
  GATEWAY_PLANNER_CODE,
  type GatewayDiagnosticData,
  toGatewayDiagnostics,
} from "../../src/gateway/gateway-diagnostic-mapper"
import { resolveGatewayRange } from "../../src/gateway/gateway-range-resolver"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

async function load(name: string): Promise<DocumentSynthState> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  return {
    uri: pathToFileURL(entryPoint).href,
    version: 1,
    result,
    positionMap,
  }
}

describe("resolveGatewayRange over inlay-pipeline.tsx", () => {
  // Statements: SET / banners / CREATE TABLE (sources, sink) / INSERT (DML).
  let state: DocumentSynthState
  beforeAll(async () => {
    state = await load("inlay-pipeline.tsx")
    expect(state.result.ok).toBe(true)
  })

  it("3.3 an origin-bearing statement maps to the originating node's range", () => {
    const origin = state.result.statementOrigins.find(
      (o) => o.component === "KafkaSource",
    )
    if (!origin) throw new Error("no source-originated statement")
    const resolved = resolveGatewayRange(
      origin.statementIndex,
      state.result,
      state.positionMap,
    )
    expect(resolved.via).toBe("origin")
    expect(resolved.nodeId).toBe(origin.nodeId)
    expect(resolved.range).toEqual(state.positionMap.map.get(origin.nodeId))
  })

  it("3.2 a DML statement (no origin) falls back to a mapped contributor", () => {
    const dml = state.result.statementContributors.find(
      (c) =>
        !state.result.statementOrigins.some(
          (o) => o.statementIndex === c.statementIndex,
        ),
    )
    if (!dml) throw new Error("no origin-less DML statement")
    const resolved = resolveGatewayRange(
      dml.statementIndex,
      state.result,
      state.positionMap,
    )
    expect(resolved.via).toBe("contributor")
    expect(resolved.nodeId).toBeDefined()
  })

  it("3.3 an unmapped origin with no mapped contributors falls back to the file top", async () => {
    // hover-catalog-pipeline's aliased factory desyncs the id counter, so the
    // IcebergSink (a DDL origin) is absent from the position map — the real
    // unmapped-origin case the chain's last step exists for.
    const catalog = await load("hover-catalog-pipeline.tsx")
    const unmapped = catalog.result.statementOrigins.find(
      (o) => !catalog.positionMap.map.has(o.nodeId),
    )
    if (!unmapped) throw new Error("expected an unmapped statement origin")
    const resolved = resolveGatewayRange(
      unmapped.statementIndex,
      catalog.result,
      catalog.positionMap,
    )
    expect(resolved.via).toBe("file-top")
    expect(resolved.range.start).toEqual({ line: 0, character: 0 })
  })
})

describe("toGatewayDiagnostics", () => {
  let state: DocumentSynthState
  beforeAll(async () => {
    state = await load("inlay-pipeline.tsx")
  })

  it("4.4 carries the distinct source, an FR-GATEWAY- code, and structured data", () => {
    const origin = state.result.statementOrigins[0]
    const [diag] = toGatewayDiagnostics(
      [
        {
          statementIndex: origin.statementIndex,
          message: "Object 'missing' not found",
          detail: {
            statement: "CREATE …",
            message: "Object 'missing' not found",
            fullMessage: "ValidationException: Object 'missing' not found",
            rootCause: "Object 'missing' not found",
          },
        },
      ],
      state.result,
      state.positionMap,
    )
    expect(diag.source).toBe(GATEWAY_DIAGNOSTIC_SOURCE)
    expect(diag.code).toBe(GATEWAY_PLANNER_CODE)
    expect(String(diag.code)).toMatch(/^FR-GATEWAY-/)
    expect(diag.message).toContain("Object 'missing' not found")
    const data = diag.data as GatewayDiagnosticData
    expect(data.statementIndex).toBe(origin.statementIndex)
    expect(data.via).toBe("origin")
    expect(data.rootCause).toBe("Object 'missing' not found")
  })

  it("4.2 a file-top fallback references the failing statement in the message", async () => {
    const catalog = await load("hover-catalog-pipeline.tsx")
    const unmapped = catalog.result.statementOrigins.find(
      (o) => !catalog.positionMap.map.has(o.nodeId),
    )
    if (!unmapped) throw new Error("expected an unmapped statement origin")
    const [diag] = toGatewayDiagnostics(
      [{ statementIndex: unmapped.statementIndex, message: "boom" }],
      catalog.result,
      catalog.positionMap,
    )
    expect(diag.message).toContain(`statement #${unmapped.statementIndex + 1}`)
    expect((diag.data as GatewayDiagnosticData).via).toBe("file-top")
  })

  it("4.3 the gateway source and code range can never collide with the static set", () => {
    expect(GATEWAY_DIAGNOSTIC_SOURCE).not.toBe(DIAGNOSTIC_SOURCE)
    for (const row of DIAGNOSTIC_CODE_TABLE) {
      expect(row.prefix.startsWith(GATEWAY_CODE_PREFIX)).toBe(false)
      expect(GATEWAY_CODE_PREFIX.startsWith(row.prefix)).toBe(false)
    }
  })
})
