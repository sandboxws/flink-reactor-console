import { describe, expect, it } from "vitest"
import { classifyWord } from "../../src/sql/vocabulary.js"

describe("classifyWord", () => {
  it("classifies reserved keywords", () => {
    for (const kw of ["SELECT", "FROM", "WHERE", "AS", "AND", "ON", "GROUP"]) {
      expect(classifyWord(kw)).toBe("keyword")
    }
  })

  it("classifies built-in and Flink-specific functions", () => {
    for (const fn of [
      "CAST",
      "UPPER",
      "COUNT",
      "TUMBLE",
      "HOP",
      "SESSION",
      "PROCTIME",
      "CURRENT_WATERMARK",
    ]) {
      expect(classifyWord(fn)).toBe("function")
    }
  })

  it("classifies type names — including parameterized ones — as types", () => {
    for (const ty of [
      "BIGINT",
      "DECIMAL",
      "TIMESTAMP",
      "TIMESTAMP_LTZ",
      "STRING",
    ]) {
      expect(classifyWord(ty)).toBe("type")
    }
  })

  it("matches case-insensitively (Flink SQL keywords are)", () => {
    expect(classifyWord("select")).toBe("keyword")
    expect(classifyWord("Cast")).toBe("function")
    expect(classifyWord("bigint")).toBe("type")
  })

  it("honors the type→function precedence for the spec's discriminating case", () => {
    // DECIMAL takes parentheses like a function but is a type; CAST/UPPER are
    // functions, not keywords.
    expect(classifyWord("DECIMAL")).toBe("type")
    expect(classifyWord("CAST")).toBe("function")
    expect(classifyWord("UPPER")).toBe("function")
  })

  it("leaves unknown identifiers unclassified (plain, never an error)", () => {
    for (const id of ["amount", "user_id", "orders", "my_udf", "FUTURE_FN"]) {
      expect(classifyWord(id)).toBeNull()
    }
  })
})
