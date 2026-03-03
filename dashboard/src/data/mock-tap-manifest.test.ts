import { describe, expect, it } from "vitest"
import {
  generateMockStreamingRows,
  generateMockTapManifest,
} from "./mock-tap-manifest"

describe("generateMockTapManifest", () => {
  it("returns a valid manifest with 4 operators", () => {
    const manifest = generateMockTapManifest()

    expect(manifest.pipelineName).toBe("ecommerce-pipeline")
    expect(manifest.flinkVersion).toBe("1.20")
    expect(manifest.taps.length).toBe(4)
  })

  it("includes source, transform, and sink component types", () => {
    const manifest = generateMockTapManifest()
    const types = new Set(manifest.taps.map((t) => t.componentType))

    expect(types.has("source")).toBe(true)
    expect(types.has("transform")).toBe(true)
    expect(types.has("sink")).toBe(true)
  })

  it("each tap has valid observation SQL", () => {
    const manifest = generateMockTapManifest()

    for (const tap of manifest.taps) {
      expect(tap.observationSql).toContain("CREATE TEMPORARY TABLE")
      expect(tap.observationSql).toContain("SELECT * FROM")
      expect(tap.nodeId.length).toBeGreaterThan(0)
      expect(tap.name.length).toBeGreaterThan(0)
      expect(tap.consumerGroupId.length).toBeGreaterThan(0)
    }
  })

  it("includes kafka and jdbc connector types", () => {
    const manifest = generateMockTapManifest()
    const connectors = new Set(manifest.taps.map((t) => t.connectorType))

    expect(connectors.has("kafka")).toBe(true)
    expect(connectors.has("jdbc")).toBe(true)
  })
})

describe("generateMockStreamingRows", () => {
  it("generates the requested number of rows", () => {
    const schema = { id: "BIGINT", name: "VARCHAR(255)" }
    const rows = generateMockStreamingRows(schema, 5)

    expect(rows.length).toBe(5)
  })

  it("generates rows with all schema fields", () => {
    const schema = {
      order_id: "BIGINT",
      product_id: "VARCHAR(255)",
      quantity: "INT",
      order_time: "TIMESTAMP(3)",
    }
    const rows = generateMockStreamingRows(schema, 3)

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(schema).sort())
    }
  })

  it("generates different values across batches", () => {
    const schema = { id: "BIGINT" }
    const batch1 = generateMockStreamingRows(schema, 2)
    const batch2 = generateMockStreamingRows(schema, 2)

    // Counter increments, so values should differ
    expect(batch1[0].id).not.toBe(batch2[0].id)
  })

  it("handles all field types", () => {
    const schema = {
      bigint_col: "BIGINT",
      int_col: "INT",
      decimal_col: "DECIMAL(10, 2)",
      timestamp_col: "TIMESTAMP(3)",
      varchar_col: "VARCHAR(255)",
      string_col: "STRING",
      bool_col: "BOOLEAN",
      double_col: "DOUBLE",
    }

    const rows = generateMockStreamingRows(schema, 1)
    const row = rows[0]

    expect(typeof row.bigint_col).toBe("number")
    expect(typeof row.int_col).toBe("number")
    expect(typeof row.decimal_col).toBe("number")
    expect(typeof row.timestamp_col).toBe("string")
    expect(typeof row.varchar_col).toBe("string")
    expect(typeof row.string_col).toBe("string")
    expect(typeof row.bool_col).toBe("boolean")
    expect(typeof row.double_col).toBe("number")
  })
})
