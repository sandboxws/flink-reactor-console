import { describe, expect, it } from "vitest"
import {
  avroRecordToColumns,
  mapAvroTypeToFlink,
} from "@/codegen/connectors/avro-types.js"

describe("mapAvroTypeToFlink", () => {
  it("maps primitive types", () => {
    expect(mapAvroTypeToFlink("long").flink).toBe("BIGINT")
    expect(mapAvroTypeToFlink("int").flink).toBe("INT")
    expect(mapAvroTypeToFlink("string").flink).toBe("STRING")
    expect(mapAvroTypeToFlink("double").flink).toBe("DOUBLE")
    expect(mapAvroTypeToFlink("float").flink).toBe("FLOAT")
    expect(mapAvroTypeToFlink("boolean").flink).toBe("BOOLEAN")
    expect(mapAvroTypeToFlink("bytes").flink).toBe("BYTES")
  })

  it("unwraps a nullable union `[null, X]`", () => {
    expect(mapAvroTypeToFlink(["null", "string"])).toEqual({
      flink: "STRING",
      nullable: true,
    })
    expect(mapAvroTypeToFlink(["long", "null"])).toEqual({
      flink: "BIGINT",
      nullable: true,
    })
  })

  it("falls back to STRING for a genuine multi-type union", () => {
    expect(mapAvroTypeToFlink(["string", "long"])).toEqual({
      flink: "STRING",
      nullable: false,
    })
  })

  it("maps logical timestamp/date/time types", () => {
    expect(
      mapAvroTypeToFlink({ type: "long", logicalType: "timestamp-millis" })
        .flink,
    ).toBe("TIMESTAMP(3)")
    expect(
      mapAvroTypeToFlink({ type: "long", logicalType: "timestamp-micros" })
        .flink,
    ).toBe("TIMESTAMP(6)")
    expect(mapAvroTypeToFlink({ type: "int", logicalType: "date" }).flink).toBe(
      "DATE",
    )
    expect(
      mapAvroTypeToFlink({ type: "int", logicalType: "time-millis" }).flink,
    ).toBe("TIME")
  })

  it("maps logical decimal with precision/scale", () => {
    expect(
      mapAvroTypeToFlink({
        type: "bytes",
        logicalType: "decimal",
        precision: 10,
        scale: 2,
      }).flink,
    ).toBe("DECIMAL(10, 2)")
  })

  it("maps array and map complex types", () => {
    expect(mapAvroTypeToFlink({ type: "array", items: "string" }).flink).toBe(
      "ARRAY<STRING>",
    )
    expect(mapAvroTypeToFlink({ type: "map", values: "long" }).flink).toBe(
      "MAP<STRING, BIGINT>",
    )
  })

  it("maps a nested record to a ROW literal", () => {
    const nested = {
      type: "record",
      name: "Address",
      fields: [
        { name: "city", type: "string" },
        { name: "zip", type: "int" },
      ],
    }
    expect(mapAvroTypeToFlink(nested).flink).toBe("ROW<city STRING, zip INT>")
  })

  it("maps enum→STRING and fixed→BYTES", () => {
    expect(mapAvroTypeToFlink({ type: "enum", symbols: ["A"] }).flink).toBe(
      "STRING",
    )
    expect(mapAvroTypeToFlink({ type: "fixed", size: 16 }).flink).toBe("BYTES")
  })

  it("falls back to STRING for unknown shapes", () => {
    expect(mapAvroTypeToFlink({ type: "weird" }).flink).toBe("STRING")
    expect(mapAvroTypeToFlink(42).flink).toBe("STRING")
  })
})

describe("avroRecordToColumns", () => {
  const orderSchema = {
    type: "record",
    name: "Order",
    fields: [
      { name: "order_id", type: "long" },
      {
        name: "amount",
        type: {
          type: "bytes",
          logicalType: "decimal",
          precision: 12,
          scale: 4,
        },
      },
      {
        name: "created_at",
        type: { type: "long", logicalType: "timestamp-millis" },
      },
      { name: "note", type: ["null", "string"] },
    ],
  }

  it("returns columns in declaration order with mapped types", () => {
    expect(avroRecordToColumns(orderSchema)).toMatchSnapshot()
  })

  it("throws when the top-level schema is not a record", () => {
    expect(() => avroRecordToColumns("string")).toThrow(/record/)
    expect(() => avroRecordToColumns(["null", "string"])).toThrow(/record/)
  })
})
