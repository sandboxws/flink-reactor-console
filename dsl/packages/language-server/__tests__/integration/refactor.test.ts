// component-refactoring (Tier-3 feature 14) over the real stdio transport:
// the `renameProvider` capability advertisement, the prepareRename → rename
// round-trip, and a diagnostic-driven `textDocument/codeAction` request —
// exactly the frames an LSP client (VS Code, IntelliJ, Neovim) sends.

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

/** 0-based position `delta` characters into the first `marker` occurrence. */
function posAt(
  text: string,
  marker: string,
  delta = 0,
): { line: number; character: number } {
  const idx = text.indexOf(marker)
  if (idx < 0) throw new Error(`marker not found: ${marker}`)
  const before = text.slice(0, idx + delta).split("\n")
  return {
    line: before.length - 1,
    character: before[before.length - 1].length,
  }
}

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

function openDoc(c: LspClient, name: string): void {
  c.notify("textDocument/didOpen", {
    textDocument: {
      uri: fixtureUri(name),
      languageId: "typescriptreact",
      version: 1,
      text: fixtureText(name),
    },
  })
}

describe("component-refactoring (integration over stdio)", () => {
  it("advertises the rename capability with prepareRename support", async () => {
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
    expect(result.capabilities.renameProvider).toEqual({
      prepareProvider: true,
    })
  })

  it("prepareRename gates and rename returns the schema-flow WorkspaceEdit", async () => {
    const c = await start()
    const name = "refactor-rename-pipeline.tsx"
    const uri = fixtureUri(name)
    const text = fixtureText(name)
    openDoc(c, name)
    // Synthesis must complete before the held state serves a rename.
    await c.waitForDiagnostics(uri, () => true)

    const position = posAt(text, "user_id: Field.BIGINT()", 2)
    const range = await c.request("textDocument/prepareRename", {
      textDocument: { uri },
      position,
    })
    expect(range).not.toBeNull()

    const edit = await c.request<{
      changes?: Record<string, Array<{ newText: string }>>
    }>("textDocument/rename", {
      textDocument: { uri },
      position,
      newName: "account_id",
    })
    const edits = edit?.changes?.[uri] ?? []
    // Declaration key + PK entry + Filter ref + Map value.
    expect(edits.length).toBeGreaterThanOrEqual(4)
    expect(edits.every((e) => e.newText === "account_id")).toBe(true)

    // A non-renamable token (SQL keyword) is rejected by the gate.
    const rejected = await c.request("textDocument/prepareRename", {
      textDocument: { uri },
      position: posAt(text, "IS NOT NULL", 1),
    })
    expect(rejected).toBeNull()
  })

  it("serves diagnostic-driven quick-fixes over textDocument/codeAction", async () => {
    const c = await start()
    const name = "schema-typo-pipeline.tsx"
    const uri = fixtureUri(name)
    openDoc(c, name)
    const diagnostics = await c.waitForDiagnostics(uri, (diags) =>
      diags.some((d) =>
        String((d as { code?: unknown }).code).startsWith("FR-SCHEMA-"),
      ),
    )
    const schemaDiag = diagnostics.find((d) =>
      String((d as { code?: unknown }).code).startsWith("FR-SCHEMA-"),
    ) as { range: { start: unknown; end: unknown } }

    const actions = await c.request<Array<{ title: string; edit?: unknown }>>(
      "textDocument/codeAction",
      {
        textDocument: { uri },
        range: schemaDiag.range,
        context: { diagnostics: [schemaDiag] },
      },
    )
    const fix = actions.find((a) => a.title.includes("`amont`"))
    expect(fix).toBeDefined()
    expect(fix?.edit).toBeDefined()
  })
})
