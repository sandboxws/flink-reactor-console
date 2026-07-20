import { describe, expect, it } from "vitest"
import {
  FR_DATA_MARKER,
  provideCompletion,
} from "../../src/providers/completion/index.js"

const SRC = `import { Pipeline, KafkaSource } from "@flink-reactor/dsl"
export default (
  <Pipeline name="x">
    <KafkaSource topic="t" format="json" />
  </Pipeline>
)
`

function cursorAt(text: string, anchor: string, delta = anchor.length) {
  const idx = text.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = text.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

const complete = (anchor: string, tsPluginActive: boolean) =>
  provideCompletion({
    sourceText: SRC,
    fileName: "p.tsx",
    position: cursorAt(SRC, anchor),
    tsPluginActive,
  })

describe("provideCompletion (coexistence + dedup marker)", () => {
  it("serves child components standalone when the ts-plugin is absent", () => {
    const list = complete('name="x">', false)
    expect(list.items.length).toBeGreaterThan(0)
    expect(list.items.map((i) => i.label)).toContain("KafkaSource")
  })

  it("suppresses child components when the ts-plugin is active", () => {
    const list = complete('name="x">', true)
    expect(list.items).toEqual([])
  })

  it("still serves connector props when the ts-plugin is active", () => {
    const list = complete("<KafkaSource ", true)
    expect(list.items.length).toBeGreaterThan(0)
    expect(list.items.map((i) => i.label)).toContain("bootstrapServers")
  })

  it("still serves enum values when the ts-plugin is active", () => {
    const list = complete('format="', true)
    expect(list.items.map((i) => i.label)).toContain("avro")
  })

  it("stamps the FR data marker on every item", () => {
    for (const anchor of ['name="x">', "<KafkaSource ", 'format="']) {
      const list = complete(anchor, false)
      expect(list.items.length).toBeGreaterThan(0)
      for (const item of list.items) {
        expect(item.data).toMatchObject({ source: FR_DATA_MARKER })
      }
    }
  })

  it("returns no items for an unclassifiable position", () => {
    expect(complete("import { ", false).items).toEqual([])
  })
})
