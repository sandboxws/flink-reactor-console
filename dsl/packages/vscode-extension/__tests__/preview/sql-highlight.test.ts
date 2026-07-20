import { describe, expect, it } from "vitest"
// Canonical vocabulary, imported straight from the language-server SOURCE (not
// the package entry, which is the un-importable full server bundle). Test-only —
// the shipped webview bundle never imports across this boundary.
import {
  FLINK_FUNCTIONS as CANON_FUNCTIONS,
  FLINK_KEYWORDS as CANON_KEYWORDS,
  FLINK_TYPES as CANON_TYPES,
} from "../../../language-server/src/sql/vocabulary"
import {
  classifyWord,
  FLINK_FUNCTIONS,
  FLINK_KEYWORDS,
  FLINK_TYPES,
  type SqlToken,
  tokenize,
} from "../../src/preview/sql-highlight"

/** Re-assemble the token texts — must always reproduce the input verbatim. */
const reassemble = (toks: SqlToken[]): string =>
  toks.map((t) => t.text).join("")
const sorted = (s: ReadonlySet<string>): string[] => [...s].sort()
/** The text of the first token classified as `category`. */
const firstOf = (toks: SqlToken[], category: string): string | undefined =>
  toks.find((t) => t.category === category)?.text

describe("vocabulary parity with language-server (drift guard)", () => {
  // The webview cannot import the canonical sets at runtime, so it mirrors them.
  // These assertions fail the build if the mirror drifts from the source.
  it("mirrors FLINK_KEYWORDS exactly", () => {
    expect(sorted(FLINK_KEYWORDS)).toEqual(sorted(CANON_KEYWORDS))
  })
  it("mirrors FLINK_FUNCTIONS exactly", () => {
    expect(sorted(FLINK_FUNCTIONS)).toEqual(sorted(CANON_FUNCTIONS))
  })
  it("mirrors FLINK_TYPES exactly", () => {
    expect(sorted(FLINK_TYPES)).toEqual(sorted(CANON_TYPES))
  })
})

describe("classifyWord", () => {
  it("classifies types, functions, and expression keywords", () => {
    expect(classifyWord("BIGINT")).toBe("type")
    expect(classifyWord("decimal")).toBe("type") // case-insensitive
    expect(classifyWord("CAST")).toBe("function")
    expect(classifyWord("SELECT")).toBe("keyword")
  })

  it("colors statement-level DDL/DML the preview shows (not in the expr set)", () => {
    // These are the prominent words in the synthesized SQL the preview renders.
    for (const w of [
      "CREATE",
      "CATALOG",
      "DATABASE",
      "VIEW",
      "INSERT",
      "INTO",
      "SET",
      "PRIMARY",
      "KEY",
      "ENFORCED",
    ]) {
      expect(classifyWord(w), `${w} should be a keyword`).toBe("keyword")
    }
  })

  it("type precedence: DECIMAL is a type even though it takes parentheses", () => {
    expect(classifyWord("DECIMAL")).toBe("type")
    expect(classifyWord("TIMESTAMP_LTZ")).toBe("type")
  })

  it("leaves unknown identifiers unclassified (columns/tables stay plain)", () => {
    expect(classifyWord("o_orderkey")).toBeNull()
    expect(classifyWord("fluss_catalog")).toBeNull()
    expect(classifyWord("my_udf")).toBeNull()
  })
})

describe("tokenize (lexeme shapes)", () => {
  it("never drops or rewrites bytes — tokens re-assemble to the input", () => {
    const sql =
      "CREATE TABLE `orders` (\n  `id` BIGINT,\n  `ts` TIMESTAMP_LTZ(3)\n) -- note\n"
    expect(reassemble(tokenize(sql))).toBe(sql)
  })

  it("classifies a CREATE TABLE statement's keywords and types", () => {
    const toks = tokenize("CREATE TABLE `orders` ( `id` BIGINT )")
    const cats = (text: string) => toks.find((t) => t.text === text)?.category
    expect(cats("CREATE")).toBe("keyword")
    expect(cats("TABLE")).toBe("keyword")
    expect(cats("BIGINT")).toBe("type")
  })

  it("never classifies the interior of a backtick identifier", () => {
    // `table` spells the TABLE keyword but is a quoted identifier — stays plain.
    const toks = tokenize("SELECT * FROM `table`")
    const backtick = toks.find((t) => t.text === "`table`")
    expect(backtick?.category).toBeNull()
    expect(firstOf(toks, "keyword")).toBe("SELECT")
  })

  it("treats a single-quoted string (with '' escape) as one string token", () => {
    const toks = tokenize("SET 'k' = 'a''b'")
    expect(firstOf(toks, "string")).toBe("'k'")
    // The escaped quote does not split the literal.
    expect(
      toks.some((t) => t.category === "string" && t.text === "'a''b'"),
    ).toBe(true)
  })

  it("recognizes line and block comments", () => {
    expect(firstOf(tokenize("SELECT 1 -- trailing\n"), "comment")).toBe(
      "-- trailing",
    )
    expect(firstOf(tokenize("/* head */ SELECT 1"), "comment")).toBe(
      "/* head */",
    )
  })

  it("recognizes numbers and runs of operators", () => {
    const toks = tokenize("amount >= 100.5")
    expect(firstOf(toks, "number")).toBe("100.5")
    expect(firstOf(toks, "operator")).toBe(">=")
  })

  it("coalesces whitespace/punctuation into plain runs (low node count)", () => {
    // The " ( " between TABLE and the column is ONE plain token, not three.
    const toks = tokenize("TABLE ( x")
    expect(toks.map((t) => [t.text, t.category])).toEqual([
      ["TABLE", "keyword"],
      [" ( ", null],
      ["x", null],
    ])
  })
})
