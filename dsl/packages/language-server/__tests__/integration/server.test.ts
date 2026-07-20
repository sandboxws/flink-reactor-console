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

/** Poll until `pred()` holds or the deadline passes (notifications arrive
 *  asynchronously after the request/diagnostic that triggered them). */
async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error("timed out waiting for condition")
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
    // crd-preview (Tier-2 feature 6) advertises its custom request under
    // `experimental` so a client can feature-detect it.
    expect(
      (caps.experimental as { flinkReactorCrdPreview?: boolean } | undefined)
        ?.flinkReactorCrdPreview,
    ).toBe(true)

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

  it("resolves a caret position to its node via flinkReactor/nodeAtPosition", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")
    openDoc(c, "dag-linear-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)

    // Resolve the KafkaSource's own range, then ask which node sits at its
    // start position — it must be the source itself (the round trip nodeRange →
    // nodeAtPosition is the DSL→SQL inverse the preview relies on).
    const range = await c.request<{
      range: { start: { line: number; character: number } } | null
    }>("flinkReactor/nodeRange", { uri, nodeId: "orders" })
    expect(range.range).not.toBeNull()

    const at = await c.request<{ nodeId: string | null }>(
      "flinkReactor/nodeAtPosition",
      { uri, position: range.range?.start },
    )
    expect(at.nodeId).toBe("orders")

    // A position off in empty space resolves to nothing, not an error.
    const none = await c.request<{ nodeId: string | null }>(
      "flinkReactor/nodeAtPosition",
      { uri, position: { line: 0, character: 0 } },
    )
    expect(none.nodeId).toBeNull()
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

  // ── sql-preview custom request (vscode-tier-2-feature-5) ─────────────

  interface SynthModel {
    uri: string
    version: number
    ok: boolean
    error?: string
    pipelines: {
      id: string
      statements: string[]
      statementOrigins: [number, { nodeId: string; component: string }][]
      statementContributors: [
        number,
        { offset: number; length: number; origin: string }[],
      ][]
      statementMeta: [number, { label: string; section: string }][]
    }[]
  }

  it("answers flinkReactor/synth with the cached per-pipeline result", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")
    openDoc(c, "dag-linear-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)

    const synth = await c.request<SynthModel>("flinkReactor/synth", { uri })
    expect(synth.ok).toBe(true)
    expect(synth.uri).toBe(uri)
    expect(synth.pipelines).toHaveLength(1)
    const [p] = synth.pipelines
    expect(p.id).toBe("dag-linear")
    expect(p.statements.some((s) => s.includes("CREATE TABLE"))).toBe(true)

    // The number-keyed maps survive as entry arrays and reconstruct.
    const origins = new Map(p.statementOrigins)
    const createIdx = p.statements.findIndex((s) => s.includes("CREATE TABLE"))
    expect(origins.get(createIdx)?.nodeId).toBe("orders")

    // The Filter's predicate span is carried for sub-statement highlighting.
    const contributors = new Map(p.statementContributors)
    const filterSpan = [...contributors.values()]
      .flat()
      .find((f) => f.origin === "Filter_1")
    expect(filterSpan).toBeDefined()
  })

  // 1.7 — `flinkReactor/synth` is a pure projection: repeated requests run NO
  // new synthesis, so the debounced re-synthesis signal never fires for them.
  it("never re-synthesizes to answer flinkReactor/synth", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")

    const synthesized: number[] = []
    c.onNotification("flinkReactor/synthesized", (p) =>
      synthesized.push((p as { version: number }).version),
    )

    openDoc(c, "dag-linear-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)
    // The open's synth pass fires the notification asynchronously after the
    // diagnostics — wait for it to land before taking the baseline.
    await waitFor(() => synthesized.length > 0)
    const passesAfterOpen = synthesized.length

    // Fire several synth requests; none of them should trigger a synthesis pass
    // (the handler is a pure projection and we never edit the document).
    for (let i = 0; i < 5; i++) {
      const synth = await c.request<SynthModel>("flinkReactor/synth", { uri })
      expect(synth.ok).toBe(true)
    }
    expect(synthesized.length).toBe(passesAfterOpen)
  })

  it("returns a failure envelope for flinkReactor/synth when nothing is cached", async () => {
    const c = await start()
    const synth = await c.request<SynthModel>("flinkReactor/synth", {
      uri: fixtureUri("never-opened.tsx"),
      version: 4,
    })
    expect(synth.ok).toBe(false)
    expect(synth.version).toBe(4)
    expect(synth.pipelines).toEqual([])
    expect(synth.error).toMatch(/synthesized/i)
  })

  // ── crd-preview custom request (vscode-tier-2-feature-6) ─────────────

  interface CrdPreviewModel {
    uri: string
    documentVersion: number
    pipelines: {
      pipelineName: string
      pipelineKind: "standard" | "cdc-pipeline"
      status: "ok" | "error" | "no-pipeline"
      error?: string
      artifacts: {
        id: string
        label: string
        filename: string
        kind: string
        yaml: string
      }[]
    }[]
  }

  it("answers flinkReactor/crdPreview with the cached artifact set", async () => {
    const c = await start()
    const uri = fixtureUri("dag-linear-pipeline.tsx")
    openDoc(c, "dag-linear-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)

    const crd = await c.request<CrdPreviewModel>("flinkReactor/crdPreview", {
      uri,
    })
    expect(crd.uri).toBe(uri)
    expect(crd.pipelines).toHaveLength(1)
    const [p] = crd.pipelines
    expect(p.status).toBe("ok")
    expect(p.pipelineKind).toBe("standard")
    expect(p.pipelineName).toBe("dag-linear")

    const deployment = p.artifacts.find((a) => a.filename === "deployment.yaml")
    expect(deployment?.kind).toBe("FlinkDeployment")
    expect(deployment?.yaml).toContain("kind: FlinkDeployment")
    expect(p.artifacts.some((a) => a.filename === "configmap.yaml")).toBe(true)
  })

  it("returns empty pipelines for flinkReactor/crdPreview when nothing is cached", async () => {
    const c = await start()
    const crd = await c.request<CrdPreviewModel>("flinkReactor/crdPreview", {
      uri: fixtureUri("never-opened.tsx"),
      version: 5,
    })
    expect(crd.documentVersion).toBe(5)
    expect(crd.pipelines).toEqual([])
  })

  // ── textDocument/definition (schema-navigation, vscode-tier-2-feature-8) ──

  interface DefLink {
    targetUri: string
    targetRange: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }

  /** Position `delta` chars into the first occurrence of `marker` in `name`. */
  function posIn(name: string, marker: string, delta: number) {
    const text = fixtureText(name)
    const before = text.slice(0, text.indexOf(marker) + delta).split("\n")
    return {
      line: before.length - 1,
      character: before[before.length - 1].length,
    }
  }

  it("resolves a column reference to its inline Schema field via definition", async () => {
    const c = await start()
    const name = "def-inline-pipeline.tsx"
    const uri = fixtureUri(name)
    openDoc(c, name)
    await c.waitForDiagnostics(uri, () => true)

    const links = await c.request<DefLink[] | null>("textDocument/definition", {
      textDocument: { uri },
      position: posIn(name, "amount > 0", 2),
    })
    expect(links).not.toBeNull()
    expect((links ?? [])[0].targetUri).toBe(uri)
  })

  it("resolves a column across files into the schema module via definition", async () => {
    const c = await start()
    const name = "def-xfile-pipeline.tsx"
    const uri = fixtureUri(name)
    openDoc(c, name)
    await c.waitForDiagnostics(uri, () => true)

    const links = await c.request<DefLink[] | null>("textDocument/definition", {
      textDocument: { uri },
      position: posIn(name, "o_orderkey > 0", 2),
    })
    expect(links).not.toBeNull()
    expect((links ?? [])[0].targetUri).toBe(
      pathToFileURL(join(FIXTURES, "schemas", "orders.ts")).href,
    )
  })

  it("returns null from definition on a non-reference token", async () => {
    const c = await start()
    const name = "def-inline-pipeline.tsx"
    const uri = fixtureUri(name)
    openDoc(c, name)
    await c.waitForDiagnostics(uri, () => true)

    const links = await c.request<DefLink[] | null>("textDocument/definition", {
      textDocument: { uri },
      position: posIn(name, "AND `order_id`", 1),
    })
    expect(links).toBeNull()
  })

  // ── flinkReactor/schemaTree custom request (schema-navigation) ───────

  interface SchemaTreeModel {
    uri: string
    version: number
    ok: boolean
    error?: string
    tables: {
      nodeId: string
      role: "source" | "sink"
      component: string
      label: string
      fields: { name: string; type: string; primaryKey: boolean }[]
      watermark?: { column: string; expression: string }
      locationRef?: { uri: string }
    }[]
  }

  it("answers flinkReactor/schemaTree with the cached sources and sinks", async () => {
    const c = await start()
    const uri = fixtureUri("def-schema-tree-pipeline.tsx")
    openDoc(c, "def-schema-tree-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)

    const tree = await c.request<SchemaTreeModel>("flinkReactor/schemaTree", {
      uri,
    })
    expect(tree.ok).toBe(true)
    expect(tree.uri).toBe(uri)
    const source = tree.tables.find((t) => t.role === "source")
    expect(source?.component).toBe("KafkaSource")
    expect(source?.fields.find((f) => f.name === "event_id")?.primaryKey).toBe(
      true,
    )
    expect(source?.watermark?.column).toBe("event_time")
    expect(tree.tables.some((t) => t.role === "sink")).toBe(true)
  })

  it("returns an error envelope for flinkReactor/schemaTree when nothing is cached", async () => {
    const c = await start()
    const tree = await c.request<SchemaTreeModel>("flinkReactor/schemaTree", {
      uri: fixtureUri("never-opened.tsx"),
      version: 9,
    })
    expect(tree.ok).toBe(false)
    expect(tree.version).toBe(9)
    expect(tree.tables).toEqual([])
  })
})
