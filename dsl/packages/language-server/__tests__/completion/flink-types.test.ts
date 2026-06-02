import { describe, expect, it } from "vitest"
import { flinkTypeCompletions } from "../../src/providers/completion/flink-types.js"

describe("flinkTypeCompletions", () => {
  const items = flinkTypeCompletions()
  const byLabel = (label: string) => items.find((i) => i.label === label)

  it("offers the Flink primitive types literally", () => {
    expect(items.map((i) => i.label)).toEqual(
      expect.arrayContaining(["BIGINT", "STRING", "BOOLEAN", "DOUBLE"]),
    )
    expect(byLabel("BIGINT")?.insertText).toBe("BIGINT")
    expect(byLabel("BIGINT")?.insertTextFormat).toBe(1 /* PlainText */)
  })

  it("inserts parameterized types with placeholder tab stops", () => {
    const decimal = byLabel("DECIMAL(p, s)")
    expect(decimal?.insertText).toBe("DECIMAL(${1:10}, ${2:2})")
    expect(decimal?.insertTextFormat).toBe(2 /* Snippet */)

    const ts = byLabel("TIMESTAMP(n)")
    expect(ts?.insertText).toBe("TIMESTAMP(${1:3})")
  })

  it("offers composite types with tab stops", () => {
    expect(byLabel("ARRAY<T>")?.insertText).toBe("ARRAY<${1:STRING}>")
    expect(byLabel("MAP<K, V>")?.insertText).toBe(
      "MAP<${1:STRING}, ${2:STRING}>",
    )
  })
})
