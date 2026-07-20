import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// Scope/structure tests for the embedded-SQL TextMate injection grammar
// (vscode-tier-2-feature-9, task 2.5). A full vscode-textmate tokenization needs
// the host `source.tsx` grammar at runtime (an E2E concern); here we validate the
// grammar's structure and its token-matching regexes directly — that each
// SQL-context entry shape is recognized, that a `name` prop is not, and that the
// vocabulary maps to the standard SQL scopes (so themes color them with no
// config).

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..")

interface Pattern {
  name?: string
  begin?: string
  end?: string
  match?: string
  patterns?: Array<{ include?: string }>
}
interface Grammar {
  scopeName: string
  injectionSelector: string
  patterns: Array<{ include?: string }>
  repository: Record<string, Pattern>
}

const grammar: Grammar = JSON.parse(
  readFileSync(
    join(ROOT, "syntaxes", "flinkreactor-sql.injection.json"),
    "utf-8",
  ),
)
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"))

/** Convert an Oniguruma `match` (possibly `(?i)`-prefixed) into a JS RegExp. */
function toRegExp(pattern: string): RegExp {
  const ci = pattern.startsWith("(?i)")
  return new RegExp(ci ? pattern.slice(4) : pattern, ci ? "im" : "m")
}

/** The first repository pattern (by name suffix) whose `name` ends with `scope`. */
function bodyMatcher(scopeSuffix: string): RegExp {
  const pat = grammar.repository["sql-body"].patterns?.find((p) =>
    p.name?.startsWith(scopeSuffix),
  )
  if (!pat?.match) throw new Error(`no sql-body pattern for ${scopeSuffix}`)
  return toRegExp(pat.match)
}

describe("flinkreactor-sql.injection grammar", () => {
  it("is registered as a source.tsx injection in the manifest", () => {
    const entry = manifest.contributes.grammars.find(
      (g: { scopeName: string }) =>
        g.scopeName === "flinkreactor.sql.injection",
    )
    expect(entry).toBeDefined()
    expect(entry.injectTo).toEqual(["source.tsx"])
    expect(grammar.scopeName).toBe("flinkreactor.sql.injection")
    expect(grammar.injectionSelector).toContain("source.tsx")
  })

  it("re-scopes interiors into the standard SQL scopes (task 2.2)", () => {
    const names = (grammar.repository["sql-body"].patterns ?? [])
      .map((p) => p.name ?? "")
      .join(" ")
    for (const scope of [
      "keyword.other.sql",
      "support.function.sql",
      "keyword.operator.sql",
      "storage.type.sql",
      "constant.numeric.sql",
      "string.quoted.single.sql",
    ]) {
      expect(names).toContain(scope)
    }
    expect(names).toMatch(/comment\.[\w.-]*sql/) // comment.line/-block .sql
  })

  it("tags every SQL token with the FR-only neutralization marker", () => {
    for (const pat of grammar.repository["sql-body"].patterns ?? []) {
      expect(pat.name).toContain("meta.embedded.flinkreactor-sql")
    }
  })

  it("recognizes a Filter.condition / Join.on / RawSQL.sql attribute, but not `name`", () => {
    const begin = toRegExp(grammar.repository["scalar-attribute"].begin ?? "")
    expect(begin.test('condition="amount > 100"')).toBe(true)
    expect(begin.test('on="user_id = id"')).toBe(true)
    expect(begin.test('sql="SELECT 1"')).toBe(true)
    // A `name` prop is NOT a SQL context.
    expect(begin.test('name="high-value-orders"')).toBe(false)
  })

  it("recognizes a Map projection object and a Validate / watermark expression", () => {
    expect(
      toRegExp(grammar.repository["select-object"].begin ?? "").test(
        "select={{",
      ),
    ).toBe(true)
    expect(
      toRegExp(
        grammar.repository["validate-expression-object"].begin ?? "",
      ).test("expression: {"),
    ).toBe(true)
    expect(
      toRegExp(grammar.repository["watermark-expression"].begin ?? "").test(
        "expression: \"ts - INTERVAL '5' SECOND\"",
      ),
    ).toBe(true)
  })

  it("categorizes the vocabulary: keywords, functions, types, operators, numbers", () => {
    expect(bodyMatcher("keyword.other.sql").exec("a SELECT b")?.[0]).toMatch(
      /select/i,
    )
    expect(bodyMatcher("keyword.other.sql").test("x AND y")).toBe(true)
    expect(bodyMatcher("support.function.sql").test("CAST(x)")).toBe(true)
    expect(bodyMatcher("support.function.sql").test("TUMBLE(...)")).toBe(true)
    expect(bodyMatcher("support.function.sql").test("UPPER(name)")).toBe(true)
    // DECIMAL is a type even before its parentheses.
    expect(bodyMatcher("storage.type.sql").test("DECIMAL(10,2)")).toBe(true)
    expect(bodyMatcher("storage.type.sql").test("TIMESTAMP_LTZ")).toBe(true)
    expect(bodyMatcher("keyword.operator.sql").test("a >= b")).toBe(true)
    expect(bodyMatcher("constant.numeric.sql").test("qty > 10")).toBe(true)
  })

  it("does not classify unknown identifiers (columns stay plain)", () => {
    expect(bodyMatcher("keyword.other.sql").test("amount")).toBe(false)
    expect(bodyMatcher("support.function.sql").test("my_udf")).toBe(false)
    expect(bodyMatcher("storage.type.sql").test("user_id")).toBe(false)
  })
})
