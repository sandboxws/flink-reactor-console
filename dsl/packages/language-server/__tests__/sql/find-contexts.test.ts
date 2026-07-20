import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { findSqlContexts } from "../../src/sql/find-contexts.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")

function contextsOf(fixture: string) {
  const fileName = join(FIXTURES, fixture)
  const text = readFileSync(fileName, "utf-8")
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  return { contexts: findSqlContexts(sf, text), text }
}

describe("findSqlContexts", () => {
  it("locates every SQL-context kind in a pipeline", () => {
    const { contexts } = contextsOf("sql-highlight-pipeline.tsx")
    const byText = new Map(contexts.map((c) => [c.text, c.kind]))

    // on-condition
    expect(byText.get("user_id = id")).toBe("on-condition")
    // clause-expression (Filter / Query.Where / Validate rule)
    expect(byText.get("amount > 100 AND name = 'vip'")).toBe(
      "clause-expression",
    )
    expect(byText.get("event_time > CURRENT_WATERMARK(event_time)")).toBe(
      "clause-expression",
    )
    expect(byText.get("amount > 0")).toBe("clause-expression")
    // projection (Map.select record values)
    expect(byText.get("CAST(amount AS DECIMAL(12, 2))")).toBe("projection")
    expect(byText.get("UPPER(name)")).toBe("projection")
    // rawsql-body
    expect(byText.get("SELECT COUNT(*) FROM orders")).toBe("rawsql-body")
    // watermark (inside a Schema(...) call, not JSX)
    expect(byText.get("event_time - INTERVAL '5' SECOND")).toBe("watermark")
  })

  it("excludes non-SQL props (names, identifiers)", () => {
    const { contexts } = contextsOf("sql-highlight-pipeline.tsx")
    const texts = contexts.map((c) => c.text)
    // `name` props and connector values are never SQL contexts.
    expect(texts).not.toContain("sql-highlight") // Pipeline name
    expect(texts).not.toContain("out") // GenericSink name
    expect(texts).not.toContain("orders") // KafkaSource topic
    expect(texts).not.toContain("event_time") // watermark `column` (bare name)
  })

  it("returns offsets that index the raw source slice exactly", () => {
    const { contexts, text } = contextsOf("sql-highlight-pipeline.tsx")
    for (const ctx of contexts) {
      expect(
        text.slice(ctx.startOffset, ctx.startOffset + ctx.text.length),
      ).toBe(ctx.text)
    }
  })

  it("is synthesis-independent: finds contexts in unparseable-but-AST-valid text", () => {
    // A self-contained snippet that would never synthesize (no Pipeline, dangling
    // refs) but parses fine — ranges must still be found.
    const text = `import { Filter } from "@flink-reactor/dsl"
const x = <Filter condition="status = 'active' AND amount > 0" />`
    const sf = ts.createSourceFile(
      "x.tsx",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const contexts = findSqlContexts(sf, text)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].text).toBe("status = 'active' AND amount > 0")
  })

  it("gracefully skips computed/interpolated values", () => {
    const text = `import { Filter } from "@flink-reactor/dsl"
const expr = "amount > 0"
const x = <Filter condition={expr} />`
    const sf = ts.createSourceFile(
      "y.tsx",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    // `condition={expr}` is a computed value — no fragment (falls back to plain).
    expect(findSqlContexts(sf, text)).toHaveLength(0)
  })
})
