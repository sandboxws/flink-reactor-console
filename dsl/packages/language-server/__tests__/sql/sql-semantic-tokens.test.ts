import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import {
  SQL_SEMANTIC_LEGEND,
  SqlSemanticTokensProvider,
  type TokenInput,
} from "../../src/providers/sql-semantic-tokens.js"
import { findSqlContexts } from "../../src/sql/find-contexts.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const FIXTURE = join(FIXTURES, "sql-highlight-pipeline.tsx")
const TEXT = readFileSync(FIXTURE, "utf-8")
const URI = pathToFileURL(FIXTURE).href

interface DecodedToken {
  line: number
  char: number
  length: number
  type: string
  modifiers: string[]
}

/** Reverse the LSP delta encoding into absolute, typed tokens via the legend. */
function decode(data: readonly number[]): DecodedToken[] {
  const out: DecodedToken[] = []
  let line = 0
  let char = 0
  for (let i = 0; i < data.length; i += 5) {
    const [dLine, dChar, length, typeIdx, modBits] = data.slice(i, i + 5)
    line += dLine
    char = dLine === 0 ? char + dChar : dChar
    out.push({
      line,
      char,
      length,
      type: SQL_SEMANTIC_LEGEND.tokenTypes[typeIdx],
      modifiers: SQL_SEMANTIC_LEGEND.tokenModifiers.filter(
        (_, b) => (modBits & (1 << b)) !== 0,
      ),
    })
  }
  return out
}

function input(over: Partial<TokenInput> = {}): TokenInput {
  return {
    uri: URI,
    version: 1,
    sourceText: TEXT,
    fileName: FIXTURE,
    enabled: true,
    ...over,
  }
}

/** Absolute offset → {line, char}, for locating expected token positions. */
function posOf(anchor: string): { line: number; char: number } {
  const at = TEXT.indexOf(anchor)
  if (at === -1) throw new Error(`anchor not found: ${anchor}`)
  const before = TEXT.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    char: at - (before.lastIndexOf("\n") + 1),
  }
}

describe("SqlSemanticTokensProvider", () => {
  it("advertises the standard LSP token types in legend order", () => {
    expect(SQL_SEMANTIC_LEGEND.tokenTypes).toEqual([
      "keyword",
      "function",
      "operator",
      "type",
      "number",
      "string",
      "comment",
    ])
    // FR-specific modifiers (the SQL context kinds).
    expect(SQL_SEMANTIC_LEGEND.tokenModifiers).toContain("rawsql-body")
    expect(SQL_SEMANTIC_LEGEND.tokenModifiers).toContain("watermark")
  })

  it("classifies tokens by type per SQL context", () => {
    const tokens = decode(new SqlSemanticTokensProvider().full(input()).data)
    const typeAt = (anchor: string): string | undefined => {
      const p = posOf(anchor)
      return tokens.find((t) => t.line === p.line && t.char === p.char)?.type
    }
    expect(typeAt("SELECT COUNT")).toBe("keyword") // RawSQL keyword
    expect(typeAt("COUNT(*)")).toBe("function")
    expect(typeAt("CAST(amount")).toBe("function") // Map projection
    expect(typeAt("CURRENT_WATERMARK(event_time)")).toBe("function") // Query.Where
    expect(typeAt("INTERVAL '5'")).toBe("keyword") // watermark expression
  })

  it("tags each token with its context-kind modifier", () => {
    const tokens = decode(new SqlSemanticTokensProvider().full(input()).data)
    const modsAt = (anchor: string): string[] => {
      const p = posOf(anchor)
      return (
        tokens.find((t) => t.line === p.line && t.char === p.char)?.modifiers ??
        []
      )
    }
    expect(modsAt("SELECT COUNT")).toContain("rawsql-body")
    expect(modsAt("INTERVAL '5'")).toContain("watermark")
    expect(modsAt("user_id = id")).toEqual([]) // `user_id` is plain — no token
  })

  it("never emits a token for an unknown identifier (columns stay plain)", () => {
    const tokens = decode(new SqlSemanticTokensProvider().full(input()).data)
    // `amount` / `event_time` are columns: no token should start on them.
    for (const col of ["amount > 100", "event_time >"]) {
      const p = posOf(col)
      expect(
        tokens.find((t) => t.line === p.line && t.char === p.char),
      ).toBeUndefined()
    }
  })

  it("emits no tokens when the semantic layer is disabled (textmate/off)", () => {
    const provider = new SqlSemanticTokensProvider()
    expect(provider.full(input({ enabled: false })).data).toEqual([])
  })

  it("caches per document version and recomputes on a new version", () => {
    const provider = new SqlSemanticTokensProvider()
    const a = provider.full(input({ version: 1 }))
    const b = provider.full(input({ version: 1 }))
    expect(b.data).toEqual(a.data) // stable for an unchanged version
    expect(a.data.length).toBeGreaterThan(0)
    // A new version whose text has no SQL contexts recomputes to empty.
    const recomputed = provider.full(
      input({ version: 2, sourceText: "const x = 1" }),
    )
    expect(recomputed.data).toEqual([])
  })

  it("is best-effort on malformed/mid-edit SQL: no throw, colors what it can", () => {
    const provider = new SqlSemanticTokensProvider()
    const text = `import { Filter } from "@flink-reactor/dsl"
const x = <Filter condition="SELECT cou" />`
    expect(() =>
      provider.full(input({ version: 3, sourceText: text })),
    ).not.toThrow()
    const tokens = decode(
      provider.full(input({ version: 3, sourceText: text })).data,
    )
    expect(tokens.some((t) => t.type === "keyword")).toBe(true) // `SELECT`
  })

  it("emits tokens only within identified SQL-context ranges (never outside)", () => {
    const tokens = decode(new SqlSemanticTokensProvider().full(input()).data)
    const sf = ts.createSourceFile(
      FIXTURE,
      TEXT,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    // Each SQL fragment's absolute character span [start, end).
    const spans = findSqlContexts(sf, TEXT).map((c) => ({
      start: c.startOffset,
      end: c.startOffset + c.text.length,
    }))
    const lineStarts = sf.getLineStarts()
    const absOf = (line: number, char: number): number =>
      lineStarts[line] + char

    expect(tokens.length).toBeGreaterThan(0)
    for (const tok of tokens) {
      const start = absOf(tok.line, tok.char)
      const within = spans.some(
        (s) => start >= s.start && start + tok.length <= s.end,
      )
      expect(within).toBe(true)
    }
  })

  it("range request returns only tokens on the requested lines", () => {
    const provider = new SqlSemanticTokensProvider()
    const watermarkLine = posOf("INTERVAL '5'").line
    const ranged = decode(
      provider.range(input(), watermarkLine, watermarkLine).data,
    )
    expect(ranged.length).toBeGreaterThan(0)
    expect(ranged.every((t) => t.line === watermarkLine)).toBe(true)
  })
})
