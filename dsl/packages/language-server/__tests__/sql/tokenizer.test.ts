import { describe, expect, it } from "vitest"
import { tokenizeSql } from "../../src/sql/tokenizer.js"

/** Map tokens to `[category, substring]` for legible assertions. */
function tagged(sql: string): [string, string][] {
  return tokenizeSql(sql).map((t) => [
    t.category,
    sql.slice(t.offset, t.offset + t.length),
  ])
}

describe("tokenizeSql", () => {
  it("categorizes keywords, functions, types, numbers, and operators", () => {
    const sql =
      "SELECT CAST(price AS DECIMAL(10,2)) AS amount FROM orders WHERE qty > 10"
    const tags = tagged(sql)
    expect(tags).toContainEqual(["keyword", "SELECT"])
    expect(tags).toContainEqual(["keyword", "AS"])
    expect(tags).toContainEqual(["keyword", "FROM"])
    expect(tags).toContainEqual(["keyword", "WHERE"])
    expect(tags).toContainEqual(["function", "CAST"])
    expect(tags).toContainEqual(["type", "DECIMAL"])
    expect(tags).toContainEqual(["number", "10"])
    expect(tags).toContainEqual(["operator", ">"])
  })

  it("recognizes Flink-specific constructs", () => {
    const tags = tagged(
      "event_time > CURRENT_WATERMARK(event_time) AND ts >= TIMESTAMP_LTZ",
    )
    expect(tags).toContainEqual(["function", "CURRENT_WATERMARK"])
    expect(tags).toContainEqual(["type", "TIMESTAMP_LTZ"])
    expect(tags).toContainEqual(["operator", ">="])
  })

  it("leaves unknown identifiers as plain text (no token)", () => {
    const tags = tagged("amount > 0")
    // `amount` is a column — not in the vocabulary, so no token for it.
    expect(tags.find(([, text]) => text === "amount")).toBeUndefined()
    expect(tags).toContainEqual(["operator", ">"])
    expect(tags).toContainEqual(["number", "0"])
  })

  it("scopes single-quoted SQL string literals", () => {
    const tags = tagged("status = 'active'")
    expect(tags).toContainEqual(["string", "'active'"])
  })

  it("scopes line and block comments", () => {
    const tags = tagged("amount > 0 -- positive only")
    expect(tags).toContainEqual(["comment", "-- positive only"])
    expect(tagged("/* note */ COUNT(*)")).toContainEqual([
      "comment",
      "/* note */",
    ])
  })

  it("never throws on malformed / mid-edit SQL and tokenizes what it can", () => {
    // Unterminated string, open block comment, half-typed keyword.
    expect(() => tokenizeSql("SELECT cou")).not.toThrow()
    expect(tagged("SELECT cou")).toContainEqual(["keyword", "SELECT"])

    const unterminated = tagged("name = 'oops")
    expect(unterminated).toContainEqual(["string", "'oops"]) // runs to end
    expect(() => tokenizeSql("a /* open")).not.toThrow()
  })

  it("does not split multi-character operators", () => {
    expect(tagged("a <= b")).toContainEqual(["operator", "<="])
    expect(tagged("a <> b")).toContainEqual(["operator", "<>"])
    expect(tagged("a || b")).toContainEqual(["operator", "||"])
  })
})
