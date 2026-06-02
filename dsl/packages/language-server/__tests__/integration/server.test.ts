import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

interface LspDiagnostic {
  code?: string
  message: string
  range: { start: { line: number; character: number } }
  severity?: number
}

const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

let client: LspClient | undefined

afterEach(() => {
  client?.kill()
  client = undefined
})

async function start(): Promise<LspClient> {
  const c = new LspClient(BIN)
  client = c
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

describe("language server (integration over stdio)", () => {
  it("advertises capabilities on initialize and exits cleanly on shutdown/exit", async () => {
    const c = new LspClient(BIN)
    client = c
    const result = await c.request<{ capabilities: Record<string, unknown> }>(
      "initialize",
      {
        processId: process.pid,
        rootUri: pathToFileURL(FIXTURES).href,
        capabilities: {},
      },
    )

    const caps = result.capabilities
    expect(caps.completionProvider).toBeDefined()
    expect(caps.hoverProvider).toBe(true)
    expect(caps.codeActionProvider).toBe(true)
    expect(caps.documentSymbolProvider).toBe(true)
    expect(caps.definitionProvider).toBe(true)
    expect(caps.inlayHintProvider).toBe(true)
    expect(caps.semanticTokensProvider).toBeDefined()
    expect(caps.textDocumentSync).toBeDefined()

    c.notify("initialized", {})
    await c.request("shutdown")
    c.notify("exit")
    const code = await c.waitForExit()
    expect(code).toBe(0)
  })

  it("publishes empty diagnostics for a valid pipeline", async () => {
    const c = await start()
    openDoc(c, "valid-pipeline.tsx")
    const diags = await c.waitForDiagnostics(
      fixtureUri("valid-pipeline.tsx"),
      () => true,
    )
    expect(diags).toEqual([])
  })

  it("publishes an FR-coded diagnostic for a validation error, then clears it on fix", async () => {
    const c = await start()
    const uri = fixtureUri("validation-error-pipeline.tsx")
    const brokenText = fixtureText("validation-error-pipeline.tsx")

    openDoc(c, "validation-error-pipeline.tsx", brokenText)

    // 7.4: a diagnostic with an FR code at a real (non-file-top) range.
    const errors = (await c.waitForDiagnostics(
      uri,
      (d) => d.length > 0,
    )) as LspDiagnostic[]
    const fr = errors.find((d) => String(d.code).startsWith("FR-"))
    expect(fr).toBeDefined()
    expect(fr?.range.start.line).toBeGreaterThan(0)

    // 7.5: fixing the condition clears diagnostics on the next pass.
    const fixedText = brokenText.replace("amount > > 100 AND", "amount > 100")
    c.notify("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: fixedText }],
    })

    const cleared = await c.waitForDiagnostics(uri, (d) => d.length === 0)
    expect(cleared).toEqual([])
  })
})
