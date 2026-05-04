import { describe, expect, it } from "vitest"
import { extractSql } from "./sql-tab"

describe("extractSql", () => {
  it("returns null when userConfig is undefined", () => {
    expect(extractSql(undefined)).toBeNull()
  })

  it("returns null when no SQL key matches", () => {
    expect(
      extractSql({
        "pipeline.name": "demo",
        "execution.runtime-mode": "STREAMING",
      }),
    ).toBeNull()
  })

  it("returns null when the SQL key is empty or whitespace", () => {
    expect(extractSql({ "pipeline.sql": "" })).toBeNull()
    expect(extractSql({ "pipeline.sql": "   \n  " })).toBeNull()
  })

  it("finds pipeline.sql when set", () => {
    const got = extractSql({ "pipeline.sql": "SELECT 1" })
    expect(got).toEqual({ key: "pipeline.sql", sql: "SELECT 1" })
  })

  it("falls back to sql.statement when pipeline.sql is absent", () => {
    const got = extractSql({ "sql.statement": "SELECT 2" })
    expect(got).toEqual({ key: "sql.statement", sql: "SELECT 2" })
  })

  it("falls back to flinkreactor.sql last", () => {
    const got = extractSql({ "flinkreactor.sql": "SELECT 3" })
    expect(got).toEqual({ key: "flinkreactor.sql", sql: "SELECT 3" })
  })

  it("prefers pipeline.sql over sql.statement when both are set", () => {
    const got = extractSql({
      "pipeline.sql": "PRIMARY",
      "sql.statement": "SECONDARY",
    })
    expect(got).toEqual({ key: "pipeline.sql", sql: "PRIMARY" })
  })

  it("prefers sql.statement over flinkreactor.sql when pipeline.sql is missing", () => {
    const got = extractSql({
      "sql.statement": "STATEMENT",
      "flinkreactor.sql": "FR",
    })
    expect(got).toEqual({ key: "sql.statement", sql: "STATEMENT" })
  })

  it("preserves multi-line SQL verbatim", () => {
    const sql = "INSERT INTO sink\nSELECT *\nFROM src\nWHERE region = 'EU'"
    expect(extractSql({ "pipeline.sql": sql })).toEqual({
      key: "pipeline.sql",
      sql,
    })
  })

  describe("pipeline.sql.b64 (transport format)", () => {
    const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64")

    it("decodes pipeline.sql.b64 into UTF-8 SQL", () => {
      const sql = "INSERT INTO sink SELECT * FROM src;"
      const got = extractSql({ "pipeline.sql.b64": b64(sql) })
      expect(got).toEqual({ key: "pipeline.sql.b64", sql })
    })

    it("decodes multi-line SQL with colons, commas, and quotes", () => {
      const sql =
        "CREATE TABLE x (\n  a STRING,\n  b BIGINT\n) WITH (\n  'connector' = 'kafka:9092'\n);"
      const got = extractSql({ "pipeline.sql.b64": b64(sql) })
      expect(got?.sql).toBe(sql)
    })

    it("prefers pipeline.sql.b64 over the raw fallback keys", () => {
      const decoded = "DECODED"
      const got = extractSql({
        "pipeline.sql.b64": b64(decoded),
        "pipeline.sql": "RAW_FALLBACK",
        "sql.statement": "ALSO_RAW",
      })
      expect(got).toEqual({ key: "pipeline.sql.b64", sql: decoded })
    })

    it("falls back to pipeline.sql when pipeline.sql.b64 is malformed", () => {
      const got = extractSql({
        "pipeline.sql.b64": "not_base64!!@#$",
        "pipeline.sql": "FALLBACK",
      })
      expect(got).toEqual({ key: "pipeline.sql", sql: "FALLBACK" })
    })

    it("falls back when pipeline.sql.b64 decodes to empty/whitespace", () => {
      const got = extractSql({
        "pipeline.sql.b64": b64("   \n\t  "),
        "pipeline.sql": "FALLBACK",
      })
      expect(got).toEqual({ key: "pipeline.sql", sql: "FALLBACK" })
    })
  })
})
