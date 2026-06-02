import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

interface CompletionItem {
  label: string
  detail?: string
  data?: { source?: string; kind?: string }
}
interface CompletionList {
  items: CompletionItem[]
}

/** Position `delta` chars into the first occurrence of `anchor`. */
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

/** Start the server, open `fixture`, and wait until synthesis has been stored
 *  (the diagnostics notification is a reliable barrier). */
async function open(fixture: string): Promise<LspClient> {
  const c = new LspClient(BIN)
  client = c
  await c.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURES).href,
    capabilities: {},
    initializationOptions: { flinkReactor: { debounce: 50 } },
  })
  c.notify("initialized", {})
  c.notify("textDocument/didOpen", {
    textDocument: {
      uri: fixtureUri(fixture),
      languageId: "typescriptreact",
      version: 1,
      text: fixtureText(fixture),
    },
  })
  await c.waitForDiagnostics(fixtureUri(fixture), () => true)
  return c
}

const columnLabels = (list: CompletionList) =>
  list.items.filter((i) => i.data?.kind === "column-ref").map((i) => i.label)

const complete = (c: LspClient, fixture: string, position: unknown) =>
  c.request<CompletionList>("textDocument/completion", {
    textDocument: { uri: fixtureUri(fixture) },
    position,
  })

describe("column completion (integration over stdio)", () => {
  it("5.1 inside a <Filter condition> offers the upstream columns + types", async () => {
    const fixture = "hover-pipeline.tsx"
    const c = await open(fixture)
    const text = fixtureText(fixture)
    const list = await complete(
      c,
      fixture,
      posAt(text, 'condition="amount', 'condition="'.length),
    )
    expect(columnLabels(list)).toEqual(
      expect.arrayContaining(["order_id", "amount", "order_time"]),
    )
    const amount = list.items.find((i) => i.label === "amount")
    expect(amount?.detail).toMatch(/DECIMAL/)
  })

  it("5.2 after a renaming <Map> offers the renamed (not original) columns", async () => {
    const fixture = "column-rename-pipeline.tsx"
    const c = await open(fixture)
    const text = fixtureText(fixture)
    const list = await complete(
      c,
      fixture,
      posAt(text, 'condition="amount', 'condition="'.length),
    )
    expect(columnLabels(list)).toContain("customer_id")
    expect(columnLabels(list)).not.toContain("user_id")
  })

  it("5.3 inside a join `on` offers columns from both sides", async () => {
    const fixture = "column-join-pipeline.tsx"
    const c = await open(fixture)
    const text = fixtureText(fixture)
    const list = await complete(
      c,
      fixture,
      posAt(text, 'on="user_id = id', 'on="'.length),
    )
    expect(columnLabels(list)).toEqual(
      expect.arrayContaining(["order_id", "user_id", "amount", "id", "name"]),
    )
  })

  it("5.4 inside a <Query.Select> after a window offers window_start/window_end", async () => {
    const fixture = "column-window-pipeline.tsx"
    const c = await open(fixture)
    const text = fixtureText(fixture)
    // Inside the Query.Select `views: "views"` value (unique to Query.Select).
    const list = await complete(c, fixture, posAt(text, ': "views"', 3))
    expect(columnLabels(list)).toEqual(
      expect.arrayContaining([
        "window_start",
        "window_end",
        "user_id",
        "views",
      ]),
    )
  })
})
