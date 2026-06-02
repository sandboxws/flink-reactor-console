import { describe, expect, it } from "vitest"
import {
  codeForCategory,
  DIAGNOSTIC_CODE_TABLE,
  FR_GENERAL_CODE,
  isFlinkReactorCode,
  TS_PLUGIN_NESTING_CODE,
} from "../../src/diagnostics/codes"

describe("diagnostic code table (cross-editor source of truth)", () => {
  it("derives each canonical code purely from its category", () => {
    for (const row of DIAGNOSTIC_CODE_TABLE) {
      expect(codeForCategory(row.category)).toBe(row.code)
      expect(row.code.startsWith(row.prefix)).toBe(true)
    }
  })

  it("maps the five behavioral categories to their documented prefixes", () => {
    expect(codeForCategory("schema")).toBe("FR-SCHEMA-001")
    expect(codeForCategory("expression")).toBe("FR-EXPR-001")
    expect(codeForCategory("connector")).toBe("FR-CONN-001")
    expect(codeForCategory("changelog")).toBe("FR-CDC-001")
    expect(codeForCategory("structure")).toBe("FR-DAG-001")
  })

  it("falls back to FR-GENERAL for an absent/unknown category", () => {
    expect(codeForCategory(undefined)).toBe(FR_GENERAL_CODE)
    expect(codeForCategory("nonsense")).toBe(FR_GENERAL_CODE)
  })

  it("only recognizes FR codes, never the ts-plugin nesting code (90100)", () => {
    expect(TS_PLUGIN_NESTING_CODE).toBe(90100)
    expect(isFlinkReactorCode("FR-SCHEMA-001")).toBe(true)
    expect(isFlinkReactorCode("90100")).toBe(false)
    expect(isFlinkReactorCode(90100)).toBe(false)
    expect(isFlinkReactorCode("2304")).toBe(false) // a TypeScript error code
    for (const row of DIAGNOSTIC_CODE_TABLE) {
      expect(isFlinkReactorCode(row.code)).toBe(true)
    }
  })
})
