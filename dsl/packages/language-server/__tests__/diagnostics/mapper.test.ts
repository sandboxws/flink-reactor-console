import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import { DiagnosticSeverity } from "vscode-languageserver"
import type { DiagnosticData } from "../../src/diagnostics/diagnostic-mapper"
import {
  isFlinkReactorCode,
  type MapperContext,
  TS_PLUGIN_NESTING_CODE,
  toLspDiagnostic,
} from "../../src/diagnostics/index"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { synthesizeDocument } from "../../src/synth/runner"
import type { ValidationDiagnostic } from "../../src/synth/types"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

// A real position map + context over the valid fixture so node ranges
// (`orders`, `Filter_1`, `Map_2`, `print`, `Pipeline_4`) are authentic.
let ctx: MapperContext

beforeAll(async () => {
  const entryPoint = join(FIXTURES, "valid-pipeline.tsx")
  const text = readFileSync(entryPoint, "utf-8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  ctx = { positionMap, sourceText: text, uri: pathToFileURL(entryPoint).href }
})

const data = (d: ReturnType<typeof toLspDiagnostic>): DiagnosticData =>
  d.data as DiagnosticData

describe("toLspDiagnostic — schema (FR-SCHEMA)", () => {
  it("codes FR-SCHEMA-001 at the referencing node and suggests the nearest column", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message:
        "Filter 'Filter_1' references unknown column 'amont' in condition",
      nodeId: "Filter_1",
      component: "Filter",
      category: "schema",
      details: {
        referencedColumn: "amont",
        availableColumns: ["order_id", "amount", "order_time"],
      },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-SCHEMA-001")
    expect(d.source).toBe("flink-reactor")
    expect(d.range).toEqual(ctx.positionMap.map.get("Filter_1"))
    expect(d.message).toContain("did you mean `amount`?")
    // Full candidate list stays in data for a later code action.
    expect(data(d).availableColumns).toEqual([
      "order_id",
      "amount",
      "order_time",
    ])
    expect(data(d).didYouMean).toBe("amount")
  })

  it("omits the suggestion when nothing is within the edit-distance threshold", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "references unknown column 'qqqqqq'",
      nodeId: "Filter_1",
      category: "schema",
      details: {
        referencedColumn: "qqqqqq",
        availableColumns: ["order_id", "amount", "order_time"],
      },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.message).not.toContain("did you mean")
    expect(data(d).didYouMean).toBeUndefined()
  })
})

describe("toLspDiagnostic — severity projection", () => {
  it("maps warning → Warning and error → Error", () => {
    const warn = toLspDiagnostic(
      {
        severity: "warning",
        message: "w",
        nodeId: "orders",
        category: "connector",
      },
      ctx,
    )
    const err = toLspDiagnostic(
      {
        severity: "error",
        message: "e",
        nodeId: "orders",
        category: "connector",
      },
      ctx,
    )
    expect(warn.severity).toBe(DiagnosticSeverity.Warning)
    expect(err.severity).toBe(DiagnosticSeverity.Error)
  })
})

describe("toLspDiagnostic — connector (FR-CONN)", () => {
  it("codes FR-CONN-001 on the component tag for an absent prop", () => {
    // `schemaRegistryUrl` is absent from the source, so the diagnostic stays
    // on the whole component (a missing prop has no value span to narrow to).
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "KafkaSource 'orders' is missing property `schemaRegistryUrl`",
      nodeId: "orders",
      component: "KafkaSource",
      category: "connector",
      details: { missingProps: ["schemaRegistryUrl"] },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-CONN-001")
    expect(d.range).toEqual(ctx.positionMap.map.get("orders"))
    expect(data(d).missingProps).toEqual(["schemaRegistryUrl"])
  })
})

describe("toLspDiagnostic — changelog (FR-CDC, cross-node)", () => {
  it("places the primary on the sink and links the source via relatedInformation", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "Sink 'print' does not support 'retract' streams",
      nodeId: "print",
      component: "GenericSink",
      category: "changelog",
      details: { sourceNodeId: "orders", sinkNodeId: "print" },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-CDC-001")
    expect(d.range).toEqual(ctx.positionMap.map.get("print"))
    expect(d.relatedInformation).toHaveLength(1)
    expect(d.relatedInformation?.[0].location.range).toEqual(
      ctx.positionMap.map.get("orders"),
    )
    expect(data(d).sourceNodeId).toBe("orders")
    expect(data(d).sinkNodeId).toBe("print")
  })

  it("degrades to no related entry when the source endpoint is unmapped", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "Sink 'print' does not support 'retract' streams",
      nodeId: "print",
      category: "changelog",
      details: { sourceNodeId: "ghost", sinkNodeId: "print" },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-CDC-001")
    expect(d.range).toEqual(ctx.positionMap.map.get("print"))
    expect(d.relatedInformation).toBeUndefined()
  })
})

describe("toLspDiagnostic — structure (FR-DAG)", () => {
  it("codes orphan/dangling FR-DAG-001 on the node", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message:
        "Orphan source 'KafkaSource' (orders): declared but never consumed",
      nodeId: "orders",
      component: "KafkaSource",
      category: "structure",
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-DAG-001")
    expect(d.range).toEqual(ctx.positionMap.map.get("orders"))
  })

  it("lists every cycle participant as relatedInformation", () => {
    const finding: ValidationDiagnostic = {
      severity: "error",
      message: "Cycle detected involving node 'Filter' (Filter_1)",
      nodeId: "Filter_1",
      component: "Filter",
      category: "structure",
      details: { relatedNodeIds: ["Map_2", "orders"] },
    }
    const d = toLspDiagnostic(finding, ctx)
    expect(d.code).toBe("FR-DAG-001")
    expect(d.relatedInformation).toHaveLength(2)
    const ranges = d.relatedInformation?.map((r) => r.location.range)
    expect(ranges).toContainEqual(ctx.positionMap.map.get("Map_2"))
    expect(ranges).toContainEqual(ctx.positionMap.map.get("orders"))
  })
})

describe("toLspDiagnostic — FR-only guarantee (tasks 1.5 / 9.3)", () => {
  it("never emits a non-FR code or the ts-plugin nesting code (90100)", () => {
    const categories: ValidationDiagnostic["category"][] = [
      "schema",
      "expression",
      "connector",
      "changelog",
      "structure",
      "sql",
      undefined,
    ]
    for (const category of categories) {
      const d = toLspDiagnostic(
        { severity: "error", message: "x", nodeId: "orders", category },
        ctx,
      )
      expect(isFlinkReactorCode(d.code)).toBe(true)
      expect(d.code).not.toBe(String(TS_PLUGIN_NESTING_CODE))
    }
  })
})
