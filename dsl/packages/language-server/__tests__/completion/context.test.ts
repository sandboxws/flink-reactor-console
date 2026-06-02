import { describe, expect, it } from "vitest"
import {
  type ClassifyPosition,
  classifyCompletion,
} from "../../src/providers/completion/context.js"

// Syntactic fixture — the classifier only parses, so nodes need not synthesize.
const SRC = `import { Pipeline, KafkaSource, Route, Schema } from "@flink-reactor/dsl"

export default (
  <Pipeline name="orders">
    <KafkaSource topic="orders" format="json" schema={Schema({ fields: { id: "BIGINT" } })} />
    <Route>
      <Route.Branch when="x > 0" />
    </Route>
  </Pipeline>
)
`

/** Cursor `delta` chars into the first occurrence of `anchor` (default: just after it). */
function cursorAt(
  text: string,
  anchor: string,
  delta = anchor.length,
): ClassifyPosition {
  const idx = text.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = text.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

const classify = (text: string, anchor: string, delta?: number) =>
  classifyCompletion(text, "pipeline.tsx", cursorAt(text, anchor, delta))

describe("classifyCompletion", () => {
  it("classifies a JSX children region as child-component", () => {
    // Cursor just after the `<Pipeline …>` opening tag (in its children).
    expect(classify(SRC, 'name="orders">')).toEqual({
      kind: "child-component",
      parent: "Pipeline",
    })
  })

  it("classifies an attribute-name slot as connector-prop, listing present props", () => {
    const ctx = classify(SRC, "<KafkaSource ")
    expect(ctx?.kind).toBe("connector-prop")
    if (ctx?.kind !== "connector-prop") throw new Error("wrong kind")
    expect(ctx.component).toBe("KafkaSource")
    expect(ctx.presentProps).toEqual(
      expect.arrayContaining(["topic", "format", "schema"]),
    )
  })

  it("classifies a string-union prop value as enum-value", () => {
    expect(classify(SRC, 'format="')).toEqual({
      kind: "enum-value",
      component: "KafkaSource",
      prop: "format",
    })
  })

  it("classifies a Schema fields type string as flink-type", () => {
    expect(classify(SRC, 'fields: { id: "')).toEqual({ kind: "flink-type" })
  })

  it("classifies the just-typed `<` mid-edit as child-component (tolerant parse)", () => {
    const mid = `export default (
  <Pipeline>
    <
  </Pipeline>
)
`
    expect(classify(mid, "    <", 5)).toEqual({
      kind: "child-component",
      parent: "Pipeline",
    })
  })

  it("yields no classification for a non-JSX position", () => {
    // Inside the import statement — not a completion context we own.
    expect(classify(SRC, "import { ")).toBeUndefined()
  })

  it("yields no classification for a plain (non-Schema, non-attribute) string", () => {
    const plain = `const greeting = "hello world"\n`
    expect(classify(plain, '"hello')).toBeUndefined()
  })

  it("never throws on malformed input", () => {
    const broken = `export default (<KafkaSource topic= format=\n`
    expect(() =>
      classifyCompletion(broken, "p.tsx", { line: 0, character: 28 }),
    ).not.toThrow()
  })
})
