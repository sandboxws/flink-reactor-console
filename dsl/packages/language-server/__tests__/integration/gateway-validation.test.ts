import { readFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LspClient } from "./harness"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = join(HERE, "..", "..")
const BIN = join(PKG, "bin", "flink-reactor-lsp.mjs")
const FIXTURES = join(PKG, "__tests__", "fixtures")

const fixtureUri = (name: string) => pathToFileURL(join(FIXTURES, name)).href
const fixtureText = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8")

interface WireDiagnostic {
  source?: string
  code?: string | number
  message: string
  range: { start: { line: number; character: number } }
}

interface DeepValidateWire {
  uri: string
  status: "clean" | "errors" | "failed" | "skipped"
  errorCount?: number
  skipReason?: string
  fromCache?: boolean
}

/**
 * A minimal in-process Flink SQL Gateway double speaking the v1 REST surface
 * the DSL `SqlGatewayClient` consumes. Statements whose text contains
 * `failMarker` plan to ERROR with a ValidationException detail; everything
 * else FINISHES.
 */
class FakeGateway {
  private server!: Server
  endpoint = ""
  failMarker: string | undefined
  sessions = 0
  statements: string[] = []

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on("data", (c: Buffer) => chunks.push(c))
      req.on("end", () => {
        const url = req.url ?? ""
        const respond = (body: unknown): void => {
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify(body))
        }
        if (req.method === "POST" && url === "/v1/sessions") {
          this.sessions += 1
          respond({ sessionHandle: `fs-${this.sessions}` })
          return
        }
        if (req.method === "DELETE") {
          res.statusCode = 200
          res.end()
          return
        }
        if (req.method === "POST" && url.endsWith("/statements")) {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            statement: string
          }
          this.statements.push(body.statement)
          const fails =
            this.failMarker !== undefined &&
            body.statement.includes(this.failMarker)
          respond({
            operationHandle: `${fails ? "op-fail" : "op-ok"}-${this.statements.length}`,
          })
          return
        }
        const status = /\/operations\/([\w-]+)\/status$/.exec(url)
        if (status) {
          respond({
            status: status[1].startsWith("op-fail") ? "ERROR" : "FINISHED",
          })
          return
        }
        const result = /\/operations\/([\w-]+)\/result\/\d+$/.exec(url)
        if (result) {
          const failed = result[1].startsWith("op-fail")
          respond({
            results: {
              columns: [
                {
                  name: failed ? "error" : "result",
                  logicalType: { type: "STRING", nullable: true },
                },
              ],
              data: [
                {
                  fields: [
                    failed
                      ? "org.apache.flink.table.api.ValidationException: Object 'missing_catalog_table' not found"
                      : "== Optimized Physical Plan ==",
                  ],
                },
              ],
            },
            resultType: "EOS",
            nextResultUri: null,
          })
          return
        }
        res.statusCode = 404
        res.end()
      })
    })
    await new Promise<void>((resolve) =>
      this.server.listen(0, "127.0.0.1", resolve),
    )
    const { port } = this.server.address() as AddressInfo
    this.endpoint = `http://127.0.0.1:${port}`
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server.close(resolve))
  }
}

async function start(gateway?: {
  endpoint: string
  validateOnSave?: boolean
}): Promise<LspClient> {
  const c = new LspClient(BIN)
  await c.request("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURES).href,
    capabilities: {},
    initializationOptions: {
      flinkReactor: {
        debounce: 50,
        ...(gateway
          ? {
              gateway: {
                enabled: true,
                endpoint: gateway.endpoint,
                validateOnSave: gateway.validateOnSave ?? false,
              },
            }
          : {}),
      },
    },
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

const deepValidate = (c: LspClient, uri: string) =>
  c.request<DeepValidateWire>("flinkReactor/deepValidate", { uri })

describe("gateway validation (integration over stdio, stubbed gateway)", () => {
  const gw = new FakeGateway()
  let c: LspClient
  const uri = fixtureUri("valid-pipeline.tsx")
  beforeAll(async () => {
    await gw.start()
    c = await start({ endpoint: gw.endpoint })
    openDoc(c, "valid-pipeline.tsx")
    await c.waitForDiagnostics(uri, () => true)
  })
  afterAll(async () => {
    c?.kill()
    await gw.stop()
  })

  it("10.1 a clean pipeline publishes no gateway diagnostics", async () => {
    const response = await deepValidate(c, uri)
    expect(response.status).toBe("clean")
    // Only plannable statements were submitted — no SET, no banners.
    expect(gw.statements.length).toBeGreaterThan(0)
    for (const submitted of gw.statements) {
      expect(submitted).toMatch(/^EXPLAIN /)
      expect(submitted).not.toMatch(/^EXPLAIN SET/i)
      expect(submitted).not.toMatch(/^EXPLAIN --/)
    }
  })

  it("10.2 a planner error maps to the originating node under the distinct source", async () => {
    // The GenericSink's DDL carries the 'print' connector — fail it.
    gw.failMarker = "'print'"
    const text = fixtureText("valid-pipeline.tsx")
    // Same SQL would hit the clean cache from 10.1 — edit the *condition* so
    // the generated SQL (and hash) change while staying valid.
    const recompiled = text.replace("amount > 100", "amount > 250")
    expect(recompiled).not.toBe(text)
    c.notify("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: recompiled }],
    })
    await c.waitForDiagnostics(uri, () => true)

    const published = c.waitForDiagnostics(uri, (diags) =>
      (diags as WireDiagnostic[]).some(
        (d) => d.source === "flink-reactor-gateway",
      ),
    )
    const response = await deepValidate(c, uri)
    expect(response.status).toBe("errors")
    expect(response.errorCount).toBe(1)

    const diags = (await published) as WireDiagnostic[]
    const gateway = diags.filter((d) => d.source === "flink-reactor-gateway")
    expect(gateway).toHaveLength(1)
    expect(gateway[0].code).toBe("FR-GATEWAY-001")
    expect(gateway[0].message).toContain("missing_catalog_table")
    // Mapped to the GenericSink's element, not the file top.
    expect(gateway[0].range.start.line).toBeGreaterThan(0)
  })

  it("7.4 an identical re-request serves the cached verdict without EXPLAIN", async () => {
    const before = gw.statements.length
    const response = await deepValidate(c, uri)
    expect(response.status).toBe("errors")
    expect(response.fromCache).toBe(true)
    expect(gw.statements.length).toBe(before)
  })

  it("6.2/6.3 validateOnSave gates the save trigger; typing never submits", async () => {
    const before = gw.statements.length
    // validateOnSave is false: a save submits nothing.
    c.notify("textDocument/didSave", { textDocument: { uri } })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(gw.statements.length).toBe(before)

    // Enable it; a save now runs a pass (cache-missed via a fresh edit).
    c.notify("workspace/didChangeConfiguration", {
      settings: {
        flinkReactor: {
          debounce: 50,
          gateway: {
            enabled: true,
            endpoint: gw.endpoint,
            validateOnSave: true,
          },
        },
      },
    })
    const text = fixtureText("valid-pipeline.tsx").replace(
      "amount > 100",
      "amount > 999",
    )
    c.notify("textDocument/didChange", {
      textDocument: { uri, version: 3 },
      contentChanges: [{ text }],
    })
    await c.waitForDiagnostics(uri, () => true)
    const beforeSave = gw.statements.length
    c.notify("textDocument/didSave", { textDocument: { uri } })
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 5000
      const poll = (): void => {
        if (gw.statements.length > beforeSave) {
          resolve()
          return
        }
        if (Date.now() > deadline) {
          reject(new Error("no pass on save"))
          return
        }
        setTimeout(poll, 50)
      }
      poll()
    })
  })
})

describe("gateway disabled by default (integration over stdio)", () => {
  it("10.3 no gateway connection or diagnostics without opt-in", async () => {
    const gw = new FakeGateway()
    await gw.start()
    const c = await start() // no gateway block at all
    try {
      const uri = fixtureUri("valid-pipeline.tsx")
      openDoc(c, "valid-pipeline.tsx")
      await c.waitForDiagnostics(uri, () => true)
      const response = await deepValidate(c, uri)
      expect(response).toEqual({
        uri,
        status: "skipped",
        skipReason: "disabled",
      })
      expect(gw.sessions).toBe(0)
      expect(gw.statements).toHaveLength(0)
    } finally {
      c.kill()
      await gw.stop()
    }
  })
})

describe("gateway + static coexistence (integration over stdio)", () => {
  it("10.4 the two sets render together and clear independently", async () => {
    const gw = new FakeGateway()
    await gw.start()
    gw.failMarker = "'print'"
    const c = await start({ endpoint: gw.endpoint })
    try {
      const uri = fixtureUri("schema-typo-pipeline.tsx")
      openDoc(c, "schema-typo-pipeline.tsx")
      // The static pass lands its FR-SCHEMA finding first.
      const staticDiags = (await c.waitForDiagnostics(
        uri,
        (d) => d.length > 0,
      )) as WireDiagnostic[]
      expect(staticDiags.some((d) => d.source === "flink-reactor")).toBe(true)

      // A gateway pass adds its own finding alongside.
      const both = c.waitForDiagnostics(uri, (diags) => {
        const sources = new Set(
          (diags as WireDiagnostic[]).map((d) => d.source),
        )
        return (
          sources.has("flink-reactor") && sources.has("flink-reactor-gateway")
        )
      })
      const response = await deepValidate(c, uri)
      expect(response.status).toBe("errors")
      await both

      // A static re-pass (an edit) must NOT clear the gateway finding.
      const text = fixtureText("schema-typo-pipeline.tsx")
      c.notify("textDocument/didChange", {
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: `${text}// trailing comment\n` }],
      })
      const afterStatic = (await c.waitForDiagnostics(
        uri,
        (d) => d.length > 0,
      )) as WireDiagnostic[]
      expect(
        afterStatic.some((d) => d.source === "flink-reactor-gateway"),
      ).toBe(true)
      expect(afterStatic.some((d) => d.source === "flink-reactor")).toBe(true)

      // Disabling the gateway clears only its half.
      const cleared = c.waitForDiagnostics(
        uri,
        (diags) =>
          (diags as WireDiagnostic[]).every(
            (d) => d.source !== "flink-reactor-gateway",
          ) && diags.length > 0,
      )
      c.notify("workspace/didChangeConfiguration", {
        settings: {
          flinkReactor: {
            debounce: 50,
            gateway: { enabled: false, endpoint: gw.endpoint },
          },
        },
      })
      const remaining = (await cleared) as WireDiagnostic[]
      expect(remaining.some((d) => d.source === "flink-reactor")).toBe(true)
    } finally {
      c.kill()
      await gw.stop()
    }
  })
})
