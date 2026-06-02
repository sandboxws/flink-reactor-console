import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

const FIXTURE = "completion-pipeline.tsx"
const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

interface CompletionItem {
  label: string
  data?: { source?: string; kind?: string }
}
interface CompletionList {
  items: CompletionItem[]
}

/** Position `delta` chars into the first occurrence of `anchor` in `text`. */
function posAt(text: string, anchor: string, delta = anchor.length) {
  const idx = text.indexOf(anchor)
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`)
  const at = idx + delta
  const before = text.slice(0, at)
  return {
    line: before.split("\n").length - 1,
    character: at - (before.lastIndexOf("\n") + 1),
  }
}

let client: LspClient | undefined
afterEach(() => {
  client?.kill()
  client = undefined
})

async function start(tsPluginActive: boolean): Promise<LspClient> {
  const c = new LspClient(BIN)
  client = c
  await c.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURES).href,
    capabilities: {},
    initializationOptions: { tsPluginActive, flinkReactor: { debounce: 50 } },
  })
  c.notify("initialized", {})
  return c
}

function openAndSettle(c: LspClient): Promise<unknown[]> {
  c.notify("textDocument/didOpen", {
    textDocument: {
      uri: fixtureUri(FIXTURE),
      languageId: "typescriptreact",
      version: 1,
      text: fixtureText(FIXTURE),
    },
  })
  // Diagnostics firing is a reliable barrier that the document was processed.
  return c.waitForDiagnostics(fixtureUri(FIXTURE), () => true)
}

const complete = (c: LspClient, position: unknown) =>
  c.request<CompletionList>("textDocument/completion", {
    textDocument: { uri: fixtureUri(FIXTURE) },
    position,
  })

const text = fixtureText(FIXTURE)
const childPos = posAt(text, 'name="orders">')
// Start of the `topic` attribute name (an attribute-name slot inside the tag).
const propPos = posAt(text, "topic=", 0)
const enumPos = posAt(text, 'format="')

describe("completion (integration over stdio)", () => {
  it("7.3 serves all four kinds standalone when the ts-plugin is absent", async () => {
    const c = await start(false)
    await openAndSettle(c)

    const child = await complete(c, childPos)
    expect(child.items.map((i) => i.label)).toContain("KafkaSource")

    const props = await complete(c, propPos)
    expect(props.items.map((i) => i.label)).toContain("bootstrapServers")

    const enums = await complete(c, enumPos)
    expect(enums.items.map((i) => i.label)).toContain("avro")
  })

  it("7.2 suppresses child components when tsPluginActive, still serves props/enums", async () => {
    const c = await start(true)
    await openAndSettle(c)

    const child = await complete(c, childPos)
    expect(child.items).toEqual([]) // ts-plugin owns child completions

    const props = await complete(c, propPos)
    expect(props.items.map((i) => i.label)).toContain("bootstrapServers")

    const enums = await complete(c, enumPos)
    expect(enums.items.map((i) => i.label)).toContain("json")
  })

  it("7.4 every item carries the FR data marker; no child dupes under the plugin", async () => {
    const c = await start(true)
    await openAndSettle(c)

    const props = await complete(c, propPos)
    expect(props.items.length).toBeGreaterThan(0)
    for (const item of props.items) {
      expect(item.data?.source).toBe("FR")
    }

    // With the ts-plugin active, the LSP emits zero child components, so there
    // is nothing to duplicate alongside the plugin's in-tsserver suggestions.
    const child = await complete(c, childPos)
    expect(child.items).toEqual([])
  })
})
