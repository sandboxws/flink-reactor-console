import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

const HOVER = "hover-pipeline.tsx"
const CATALOG = "hover-catalog-pipeline.tsx"

const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

interface HoverResult {
  contents?: { kind: string; value: string }
  range?: unknown
}

/** Position `delta` chars into the first occurrence of `anchor` in `text`. */
function posAt(text: string, anchor: string, delta: number) {
  const idx = text.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = text.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

async function start(): Promise<LspClient> {
  const c = new LspClient(BIN)
  await c.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURES).href,
    capabilities: {},
    initializationOptions: { flinkReactor: { debounce: 50 } },
  })
  c.notify("initialized", {})
  return c
}

function openDoc(c: LspClient, name: string, text?: string): void {
  c.notify("textDocument/didOpen", {
    textDocument: {
      uri: fixtureUri(name),
      languageId: "typescriptreact",
      version: 1,
      text: text ?? fixtureText(name),
    },
  })
}

const hover = (c: LspClient, uri: string, position: unknown) =>
  c.request<HoverResult | null>("textDocument/hover", {
    textDocument: { uri },
    position,
  })

const cardValue = (h: HoverResult | null): string => h?.contents?.value ?? ""

describe("synthesis-backed hover (integration over stdio)", () => {
  // 5.1: one server + open KafkaSource → Filter → JdbcSink for the mapped cases.
  let c: LspClient
  const text = fixtureText(HOVER)
  const uri = fixtureUri(HOVER)
  beforeAll(async () => {
    c = await start()
    openDoc(c, HOVER)
    await c.waitForDiagnostics(uri, () => true) // synthesis stored
  })
  afterAll(() => c?.kill())

  it("5.2 source tag → inferred schema + append changelog mode", async () => {
    const v = cardValue(await hover(c, uri, posAt(text, "<KafkaSource", 3)))
    expect(v).toContain("order_id")
    expect(v).toContain("TIMESTAMP(3)")
    expect(v).toContain("append")
  })

  it("5.3 Filter tag → the emitted WHERE fragment", async () => {
    const v = cardValue(await hover(c, uri, posAt(text, "<Filter", 3)))
    expect(v).toContain("WHERE")
    expect(v).toContain("amount > 0")
  })

  it("5.4 sink tag → accepted changelog modes + compatibility + INSERT", async () => {
    const v = cardValue(await hover(c, uri, posAt(text, "<JdbcSink", 3)))
    expect(v).toContain("Accepts changelog modes")
    expect(v).toContain("retract")
    expect(v).toContain("compatible")
    expect(v).toContain("INSERT INTO")
  })

  it("5.5 topic prop → description, type, required", async () => {
    const v = cardValue(await hover(c, uri, posAt(text, 'topic="', 2)))
    expect(v).toContain("Kafka topic to read from")
    expect(v).toContain("string")
    expect(v).toContain("required")
  })

  it("5.6 column ref → the field's Flink type from the upstream schema", async () => {
    const v = cardValue(await hover(c, uri, posAt(text, "amount > 0", 2)))
    expect(v).toContain("DECIMAL")
  })

  it("a non-FlinkReactor position yields no hover (defers to ts-plugin)", async () => {
    const h = await hover(c, uri, posAt(text, "Field,", 2)) // import specifier
    expect(h).toBeNull()
  })
})

describe("hover edge cases (integration over stdio)", () => {
  let c: LspClient | undefined
  afterEach(() => {
    c?.kill()
    c = undefined
  })

  it("5.6 unknown identifier → an explicit 'unknown column' note", async () => {
    c = await start()
    const text = fixtureText(HOVER).replace(
      'condition="amount > 0"',
      'condition="missing_col > 0"',
    )
    openDoc(c, HOVER, text)
    await c.waitForDiagnostics(fixtureUri(HOVER), () => true)
    const v = cardValue(
      await hover(c, fixtureUri(HOVER), posAt(text, "missing_col", 2)),
    )
    expect(v).toContain("unknown column")
  })

  it("5.7 a node not in the position map → a minimal static card, server stays responsive", async () => {
    c = await start()
    const text = fixtureText(CATALOG)
    const uri = fixtureUri(CATALOG)
    openDoc(c, CATALOG)
    await c.waitForDiagnostics(uri, () => true)

    // The IcebergSink is unmapped (the programmatic catalog shifts ids): a
    // minimal static card, not the full synthesis-backed sink card.
    const sink = cardValue(await hover(c, uri, posAt(text, "<IcebergSink", 3)))
    expect(sink).toContain("IcebergSink")
    expect(sink).toContain("Iceberg")
    expect(sink).not.toContain("Accepts changelog modes")

    // The server is still responsive: the mapped source still gets a full card.
    const src = cardValue(await hover(c, uri, posAt(text, "<KafkaSource", 3)))
    expect(src).toContain("order_id")
  })
})
