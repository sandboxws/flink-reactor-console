import { describe, expect, it } from "vitest"
import { classifyToken } from "../../src/hover/classify.js"
import type { Position } from "../../src/hover/resolve.js"

// A small pipeline used purely as parse input — the classifier is syntactic, so
// nodes need not be valid/synthesizable. Positions are derived from the text by
// searching for a token, so the fixture can evolve without re-counting columns.
const SRC = `import { Pipeline, KafkaSource, Filter, Query } from "@flink-reactor/dsl"

export default (
  <Pipeline name="orders">
    <KafkaSource name="orders" topic="orders_topic" />
    <Filter condition="amount > 0 AND region = 'us'" />
    <Query.Where condition="status = 1" />
  </Pipeline>
)
`

/** The position at the middle of the `occurrence`-th instance of `needle`. */
function posOf(text: string, needle: string, occurrence = 1): Position {
  let idx = -1
  for (let i = 0; i < occurrence; i++) idx = text.indexOf(needle, idx + 1)
  if (idx === -1) throw new Error(`not found: ${needle} #${occurrence}`)
  const at = idx + Math.floor(needle.length / 2)
  const before = text.slice(0, at)
  const line = before.split("\n").length - 1
  const character = at - (before.lastIndexOf("\n") + 1)
  return { line, character }
}

const classify = (pos: Position) => classifyToken(SRC, "pipeline.tsx", pos)

describe("classifyToken", () => {
  it("classifies a component tag name", () => {
    expect(classify(posOf(SRC, "KafkaSource", 2))).toEqual({
      kind: "tag",
      tag: "KafkaSource",
      range: expect.anything(),
    })
  })

  it("classifies a dot-notation tag (Query.Where) from either segment", () => {
    // hovering "Query" of "Query.Where" (the cursor lands on the dot/name)
    expect(classify(posOf(SRC, "Query.Where"))).toEqual({
      kind: "tag",
      tag: "Query.Where",
      range: expect.anything(),
    })
    // hovering "Where" of "Query.Where"
    expect(classify(posOf(SRC, "Where"))?.tag).toBe("Query.Where")
  })

  it("classifies a connector attribute name", () => {
    const tok = classify(posOf(SRC, "topic"))
    expect(tok).toEqual({
      kind: "prop",
      tag: "KafkaSource",
      prop: "topic",
      range: expect.anything(),
    })
  })

  it("classifies a column reference inside an expression prop", () => {
    const tok = classify(posOf(SRC, "amount"))
    expect(tok?.kind).toBe("column-ref")
    if (tok?.kind === "column-ref") {
      expect(tok.ident).toBe("amount")
      expect(tok.prop).toBe("condition")
      expect(tok.tag).toBe("Filter")
    }
  })

  it("does NOT treat a SQL keyword inside an expression as a column", () => {
    // "AND" sits inside Filter.condition but is a keyword, not a column.
    expect(classify(posOf(SRC, "AND"))).toBeUndefined()
  })

  it("does NOT treat a single-quoted SQL string as a column", () => {
    // hovering `us` inside region = 'us'
    expect(classify(posOf(SRC, "us"))).toBeUndefined()
  })

  it("returns undefined for a non-FlinkReactor position (import specifier)", () => {
    // "Pipeline" in the import statement is not a JSX tag.
    expect(classify(posOf(SRC, "Pipeline", 1))).toBeUndefined()
  })

  it("returns undefined for a non-expression prop value", () => {
    // the value of `topic="orders_topic"` is not a column reference
    expect(classify(posOf(SRC, "orders_topic"))).toBeUndefined()
  })
})
