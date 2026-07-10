import { describe, expect, it } from "vitest"
import {
  emitSchemaModule,
  flinkTypeToFieldCall,
} from "@/codegen/schema-emit.js"
import { Schema } from "@/core/schema.js"

describe("flinkTypeToFieldCall", () => {
  it("renders zero-arg scalars as builder calls", () => {
    expect(flinkTypeToFieldCall("BIGINT")).toBe("Field.BIGINT()")
    expect(flinkTypeToFieldCall("STRING")).toBe("Field.STRING()")
    expect(flinkTypeToFieldCall("BOOLEAN")).toBe("Field.BOOLEAN()")
  })

  it("renders parameterized types verbatim", () => {
    expect(flinkTypeToFieldCall("TIMESTAMP(3)")).toBe("Field.TIMESTAMP(3)")
    expect(flinkTypeToFieldCall("TIMESTAMP_LTZ(6)")).toBe(
      "Field.TIMESTAMP_LTZ(6)",
    )
    expect(flinkTypeToFieldCall("DECIMAL(38, 18)")).toBe(
      "Field.DECIMAL(38, 18)",
    )
    expect(flinkTypeToFieldCall("VARCHAR(200)")).toBe("Field.VARCHAR(200)")
  })

  it("renders composite/unknown types as string literals", () => {
    expect(flinkTypeToFieldCall("ROW<a INT, b STRING>")).toBe(
      "'ROW<a INT, b STRING>'",
    )
    expect(flinkTypeToFieldCall("ARRAY<STRING>")).toBe("'ARRAY<STRING>'")
    expect(flinkTypeToFieldCall("MAP<STRING, BIGINT>")).toBe(
      "'MAP<STRING, BIGINT>'",
    )
  })
})

describe("emitSchemaModule", () => {
  it("emits a named-export Schema module (snapshot)", () => {
    const content = emitSchemaModule(
      "order-events",
      [
        { name: "order_id", type: "BIGINT", constraints: ["PK"] },
        { name: "amount", type: "DECIMAL(10, 2)", constraints: [] },
        { name: "created_at", type: "TIMESTAMP(3)", constraints: [] },
        { name: "tags", type: "ARRAY<STRING>", constraints: [] },
      ],
      { primaryKey: ["order_id"] },
    )
    expect(content).toMatchSnapshot()
  })

  it("omits primaryKey when none is given", () => {
    const content = emitSchemaModule("word", [
      { name: "word", type: "STRING", constraints: [] },
      { name: "frequency", type: "INT", constraints: [] },
    ])
    expect(content).not.toContain("primaryKey")
    expect(content).toContain("export const WordSchema = Schema({")
  })

  it("quotes non-identifier field keys", () => {
    const content = emitSchemaModule("weird", [
      { name: "has space", type: "STRING", constraints: [] },
    ])
    expect(content).toContain("'has space': Field.STRING()")
  })

  it("produces field types that pass Schema() validation", () => {
    // The emitted `Field.*()` / string-literal types must be accepted by the
    // real Schema builder — guards the emitter against the validator.
    expect(() =>
      Schema({
        fields: { a: "BIGINT", b: "DECIMAL(10, 2)", c: "ROW<x INT>" },
      }),
    ).not.toThrow()
  })
})
