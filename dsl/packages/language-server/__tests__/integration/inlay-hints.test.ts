import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

const INLAY = "inlay-pipeline.tsx"
const CATALOG = "hover-catalog-pipeline.tsx"

const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

interface WireLabelPart {
  value: string
  tooltip?: { kind: string; value: string } | string
}

interface WireInlayHint {
  position: { line: number; character: number }
  label: WireLabelPart[] | string
  paddingLeft?: boolean
}

const FULL_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 10_000, character: 0 },
}

/** 7.1 — spawn the server over stdio, declaring inlay-hint refresh support. */
async function start(): Promise<LspClient> {
  const c = new LspClient(BIN)
  await c.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURES).href,
    capabilities: { workspace: { inlayHint: { refreshSupport: true } } },
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

const queryHints = (
  c: LspClient,
  uri: string,
  range: typeof FULL_RANGE = FULL_RANGE,
) =>
  c.request<WireInlayHint[] | null>("textDocument/inlayHint", {
    textDocument: { uri },
    range,
  })

const labelOf = (hint: WireInlayHint): string =>
  typeof hint.label === "string"
    ? hint.label
    : hint.label.map((p) => p.value).join("")

/** The hint anchored at the end of the opening tag that starts at `marker`.
 *  Handles multi-line tags by scanning forward to the tag's closing `>`. */
function hintAt(
  hints: readonly WireInlayHint[],
  text: string,
  marker: string,
): WireInlayHint | undefined {
  const start = text.indexOf(marker)
  if (start === -1) throw new Error(`marker not found: ${marker}`)
  const close = text.indexOf(">", start)
  const anchorLine = text.slice(0, close).split("\n").length - 1
  return hints.find((h) => h.position.line === anchorLine)
}

describe("synthesis-backed inlay hints (integration over stdio)", () => {
  let c: LspClient
  const uri = fixtureUri(INLAY)
  const text = fixtureText(INLAY)
  beforeAll(async () => {
    c = await start()
    openDoc(c, INLAY)
    await c.waitForDiagnostics(uri, () => true) // synthesis stored
  })
  afterAll(() => c?.kill())

  it("7.2 each node's hint shows count, changelog mode, and parallelism", async () => {
    const hints = (await queryHints(c, uri)) ?? []
    expect(
      labelOf(hintAt(hints, text, 'topic="orders"') as WireInlayHint),
    ).toBe("4 cols · append · p=4")
    expect(labelOf(hintAt(hints, text, 'topic="users"') as WireInlayHint)).toBe(
      "2 cols · append · p=4",
    )
    expect(labelOf(hintAt(hints, text, "<Filter") as WireInlayHint)).toBe(
      "6 cols · append · p=4",
    )
    expect(labelOf(hintAt(hints, text, "<IcebergSink") as WireInlayHint)).toBe(
      "2 cols · append · p=4",
    )
  })

  it("7.3 the window hint annotates the injected time columns; the join its merged count", async () => {
    const hints = (await queryHints(c, uri)) ?? []
    expect(labelOf(hintAt(hints, text, "<TumbleWindow") as WireInlayHint)).toBe(
      "4 cols · +window_start, +window_end · append · p=4",
    )
    expect(labelOf(hintAt(hints, text, "<Join") as WireInlayHint)).toBe(
      "6 cols · → 6 cols · append · p=4",
    )
  })

  it("7.4 hovering a count schema hint expands to the full column | TYPE schema", async () => {
    const hints = (await queryHints(c, uri)) ?? []
    const source = hintAt(hints, text, 'topic="orders"') as WireInlayHint
    const schemaPart = (source.label as WireLabelPart[])[0]
    const tooltip = schemaPart.tooltip
    const value = typeof tooltip === "object" ? tooltip.value : (tooltip ?? "")
    expect(value).toContain("| `order_id` | `BIGINT` |")
    expect(value).toContain("| `amount` | `DECIMAL(10, 2)` |")
    expect(value).toContain("| `order_time` | `TIMESTAMP(3)` |")
  })

  it("7.5 flipping schema to compact and parallelism off changes the parts", async () => {
    c.notify("workspace/didChangeConfiguration", {
      settings: {
        flinkReactor: {
          debounce: 50,
          inlayHints: { schema: "compact", parallelism: false },
        },
      },
    })
    // The settings change re-schedules synthesis; wait for it to land so the
    // re-query reads a stored (non-trailing) state.
    await c.waitForDiagnostics(uri, () => true)
    const hints = (await queryHints(c, uri)) ?? []
    const users = hintAt(hints, text, 'topic="users"') as WireInlayHint
    expect(labelOf(users)).toBe("[id, name] · append")
    // Restore explicitly — config parsing layers over the *current* values, so
    // an empty payload would keep compact/parallelism-off.
    c.notify("workspace/didChangeConfiguration", {
      settings: {
        flinkReactor: {
          debounce: 50,
          inlayHints: { schema: "count", parallelism: true },
        },
      },
    })
    await c.waitForDiagnostics(uri, () => true)
  })

  it("7.6 editing the Map projection refreshes and updates the counts", async () => {
    // Drain any in-flight refresh from the previous synthesis: JSON-RPC frames
    // arrive in order, so once this round-trip resolves, everything the server
    // sent earlier has been dispatched — the counter below starts clean.
    await queryHints(c, uri)
    let refreshes = 0
    const refreshed = new Promise<void>((resolve) => {
      c.onNotification("workspace/inlayHint/refresh", () => {
        refreshes += 1
        resolve()
      })
    })
    const edited = text.replace(
      'select={{ user_id: "user_id", total: "total" }}',
      'select={{ user_id: "user_id", total: "total", window_start: "window_start" }}',
    )
    expect(edited).not.toBe(text)
    c.notify("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: edited }],
    })
    await c.waitForDiagnostics(uri, () => true)
    await refreshed
    // Exactly one refresh per synthesis: a hypothetical extra would have been
    // dispatched before this ordered round-trip resolves.
    await queryHints(c, uri)
    expect(refreshes).toBe(1)

    const hints = (await queryHints(c, uri)) ?? []
    // The Map now projects 3 columns; the sink ingests them.
    expect(labelOf(hintAt(hints, edited, "<Map") as WireInlayHint)).toBe(
      "3 cols · append · p=4",
    )
    expect(
      labelOf(hintAt(hints, edited, "<IcebergSink") as WireInlayHint),
    ).toBe("3 cols · append · p=4")
  })
})

describe("inlay hints — programmatic node (integration over stdio)", () => {
  let c: LspClient
  afterAll(() => c?.kill())

  it("7.7 an unmapped node has no hint while siblings do; the server stays responsive", async () => {
    c = await start()
    const uri = fixtureUri(CATALOG)
    const text = fixtureText(CATALOG)
    openDoc(c, CATALOG)
    await c.waitForDiagnostics(uri, () => true)

    const hints = (await queryHints(c, uri)) ?? []
    // The aliased-factory catalog desyncs the counter ids: the IcebergSink is
    // unmapped (no hint), while the name-derived KafkaSource still annotates.
    expect(hintAt(hints, text, "<KafkaSource")).toBeDefined()
    expect(hintAt(hints, text, "<IcebergSink")).toBeUndefined()

    // Still responsive after the degraded request.
    const again = await queryHints(c, uri)
    expect(again).not.toBeNull()
  })
})
