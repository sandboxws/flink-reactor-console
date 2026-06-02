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
  relatedInformation?: Array<{
    location: { uri: string; range: { start: { line: number } } }
    message: string
  }>
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

  it("publishes a cross-node FR-CDC diagnostic linking the source", async () => {
    const c = await start()
    const uri = fixtureUri("changelog-cross-node-pipeline.tsx")
    openDoc(c, "changelog-cross-node-pipeline.tsx")

    const diags = (await c.waitForDiagnostics(
      uri,
      (d) => d.length > 0,
    )) as LspDiagnostic[]

    const cdc = diags.find((d) => String(d.code).startsWith("FR-CDC-"))
    expect(cdc).toBeDefined()
    // The cross-node link to the source endpoint is carried over the wire.
    expect(cdc?.relatedInformation?.length).toBeGreaterThan(0)
    expect(cdc?.relatedInformation?.[0].location.uri).toBe(uri)
  })

  it("publishes an FR-DAG diagnostic for an orphan source", async () => {
    const c = await start()
    const uri = fixtureUri("orphan-source-pipeline.tsx")
    openDoc(c, "orphan-source-pipeline.tsx")

    const diags = (await c.waitForDiagnostics(
      uri,
      (d) => d.length > 0,
    )) as LspDiagnostic[]

    const dag = diags.find((d) => String(d.code).startsWith("FR-DAG-"))
    expect(dag).toBeDefined()
    expect(dag?.message).toContain("lonely")
  })

  // ── dag-visualization custom requests (vscode-tier-2-feature-7) ──────

  interface GraphModel {
    uri: string
    version: number
    ok: boolean
    error?: string
    nodes: Array<{ id: string; kind: string; label: string }>
    edges: Array<{ from: string; to: string }>
    statements: string[]
  }

  it("answers flinkReactor/graphModel and notifies flinkReactor/synthesized", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")

    const synthesized: Array<{ uri: string; version: number }> = []
    c.onNotification("flinkReactor/synthesized", (p) =>
      synthesized.push(p as { uri: string; version: number }),
    )

    openDoc(c, "dag-linear-pipeline.tsx")
    // Diagnostics publish right after the store is populated → safe to request.
    await c.waitForDiagnostics(uri, () => true)

    const model = await c.request<GraphModel>("flinkReactor/graphModel", {
      uri,
    })
    expect(model.ok).toBe(true)
    expect(model.uri).toBe(uri)
    expect(model.nodes.map((n) => n.id).sort()).toEqual(
      ["Filter_1", "orders", "sink_out"].sort(),
    )
    expect(model.edges).toHaveLength(2)
    expect(model.statements.some((s) => s.includes("CREATE TABLE"))).toBe(true)

    // The debounced re-synthesis signal fired for this document.
    expect(synthesized.some((s) => s.uri === uri)).toBe(true)
  })

  it("resolves a node's source range via flinkReactor/nodeRange", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")
    openDoc(c, "dag-linear-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)

    const hit = await c.request<{ range: { start: { line: number } } | null }>(
      "flinkReactor/nodeRange",
      { uri, nodeId: "orders" },
    )
    expect(hit.range).not.toBeNull()
    expect(hit.range?.start.line).toBeGreaterThan(0)

    const miss = await c.request<{ range: unknown }>("flinkReactor/nodeRange", {
      uri,
      nodeId: "does-not-exist",
    })
    expect(miss.range).toBeNull()
  })

  it("returns an error envelope (not an RPC error) when no synthesis is cached", async () => {
    const c = await start()
    const model = await c.request<GraphModel>("flinkReactor/graphModel", {
      uri: fixtureUri("never-opened.tsx"),
      version: 1,
    })
    expect(model.ok).toBe(false)
    expect(model.error).toMatch(/synthesized/i)
  })
})
