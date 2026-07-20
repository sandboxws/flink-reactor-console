import { describe, expect, it } from "vitest"
import type { Diagnostic } from "vscode-languageserver"
import { DualChannelDiagnostics } from "../../src/gateway/publisher"

const URI = "file:///p/pipelines/orders/index.tsx"

const staticDiag = (msg: string): Diagnostic => ({
  range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
  message: msg,
  source: "flink-reactor",
  code: "FR-SCHEMA-001",
})

const gatewayDiag = (msg: string): Diagnostic => ({
  range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
  message: msg,
  source: "flink-reactor-gateway",
  code: "FR-GATEWAY-001",
})

function harness() {
  const published: Diagnostic[][] = []
  const channel = new DualChannelDiagnostics((_uri, diags) => {
    published.push(diags)
  })
  const last = () => published[published.length - 1]
  return { channel, published, last }
}

describe("DualChannelDiagnostics", () => {
  it("5.3 gateway and static diagnostics coexist on one document", () => {
    const { channel, last } = harness()
    channel.setStatic(URI, [staticDiag("typo")])
    channel.setGateway(URI, [gatewayDiag("missing table")])
    expect(last().map((d) => d.source)).toEqual([
      "flink-reactor",
      "flink-reactor-gateway",
    ])
  })

  it("5.3 a static pass replaces only the static half", () => {
    const { channel, last } = harness()
    channel.setGateway(URI, [gatewayDiag("missing table")])
    channel.setStatic(URI, [staticDiag("new finding")])
    channel.setStatic(URI, []) // a clean static pass
    expect(last().map((d) => d.code)).toEqual(["FR-GATEWAY-001"])
  })

  it("5.2 a clean gateway pass clears only gateway diagnostics", () => {
    const { channel, last } = harness()
    channel.setStatic(URI, [staticDiag("typo")])
    channel.setGateway(URI, [gatewayDiag("missing table")])
    channel.clearGateway(URI)
    expect(last().map((d) => d.code)).toEqual(["FR-SCHEMA-001"])
  })

  it("5.2 clearing an empty gateway half publishes nothing extra", () => {
    const { channel, published } = harness()
    channel.setStatic(URI, [staticDiag("typo")])
    const count = published.length
    channel.clearGateway(URI)
    expect(published.length).toBe(count)
  })

  it("5.2 clearAllGateway sweeps every document's gateway half", () => {
    const { channel, published } = harness()
    channel.setStatic(URI, [staticDiag("typo")])
    channel.setGateway(URI, [gatewayDiag("a")])
    channel.setGateway("file:///other.tsx", [gatewayDiag("b")])
    channel.clearAllGateway()
    const lastTwo = published.slice(-2)
    expect(lastTwo.flat().every((d) => d.source === "flink-reactor")).toBe(true)
    expect(channel.gatewayCount(URI)).toBe(0)
  })

  it("forget drops both halves and clears client-side", () => {
    const { channel, last } = harness()
    channel.setStatic(URI, [staticDiag("typo")])
    channel.setGateway(URI, [gatewayDiag("a")])
    channel.forget(URI)
    expect(last()).toEqual([])
  })
})
