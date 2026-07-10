import { describe, expect, it } from "vitest"
import {
  jsonSchemaToColumns,
  mapJsonSchemaTypeToFlink,
} from "@/codegen/connectors/json-schema-types.js"

describe("mapJsonSchemaTypeToFlink", () => {
  it("maps scalar types", () => {
    expect(mapJsonSchemaTypeToFlink({ type: "integer" })).toBe("BIGINT")
    expect(mapJsonSchemaTypeToFlink({ type: "number" })).toBe("DOUBLE")
    expect(mapJsonSchemaTypeToFlink({ type: "boolean" })).toBe("BOOLEAN")
    expect(mapJsonSchemaTypeToFlink({ type: "string" })).toBe("STRING")
  })

  it("maps string formats to temporal types", () => {
    expect(
      mapJsonSchemaTypeToFlink({ type: "string", format: "date-time" }),
    ).toBe("TIMESTAMP(3)")
    expect(mapJsonSchemaTypeToFlink({ type: "string", format: "date" })).toBe(
      "DATE",
    )
    expect(mapJsonSchemaTypeToFlink({ type: "string", format: "time" })).toBe(
      "TIME",
    )
  })

  it("unwraps a nullable `[type, null]` union", () => {
    expect(mapJsonSchemaTypeToFlink({ type: ["string", "null"] })).toBe(
      "STRING",
    )
    expect(mapJsonSchemaTypeToFlink({ type: ["null", "integer"] })).toBe(
      "BIGINT",
    )
  })

  it("maps object and array to composite types", () => {
    expect(
      mapJsonSchemaTypeToFlink({
        type: "object",
        properties: { a: { type: "integer" }, b: { type: "string" } },
      }),
    ).toBe("ROW<a BIGINT, b STRING>")
    expect(
      mapJsonSchemaTypeToFlink({ type: "array", items: { type: "number" } }),
    ).toBe("ARRAY<DOUBLE>")
  })

  it("falls back to STRING for unknown/absent types", () => {
    expect(mapJsonSchemaTypeToFlink({ type: "null" })).toBe("STRING")
    expect(mapJsonSchemaTypeToFlink({})).toBe("STRING")
    expect(mapJsonSchemaTypeToFlink(42)).toBe("STRING")
  })
})

describe("jsonSchemaToColumns", () => {
  const schema = {
    type: "object",
    properties: {
      id: { type: "integer" },
      price: { type: "number" },
      active: { type: "boolean" },
      created: { type: "string", format: "date-time" },
    },
  }

  it("returns columns in property order with mapped types", () => {
    expect(jsonSchemaToColumns(schema)).toMatchSnapshot()
  })

  it("throws when the top-level schema has no properties", () => {
    expect(() => jsonSchemaToColumns({ type: "string" })).toThrow(/properties/)
    expect(() => jsonSchemaToColumns(42)).toThrow(/properties/)
  })
})
