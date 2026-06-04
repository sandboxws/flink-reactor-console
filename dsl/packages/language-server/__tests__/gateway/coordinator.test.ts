import { describe, expect, it } from "vitest"
import type { Diagnostic } from "vscode-languageserver"
import { DEFAULT_GATEWAY, type GatewayConfig } from "../../src/config"
import type { DocumentSynthState } from "../../src/document-state"
import { GatewayCoordinator } from "../../src/gateway/coordinator"
import type {
  DeepValidateOutcome,
  GatewayValidatorLike,
} from "../../src/gateway/deep-validate"
import type { GatewayState } from "../../src/gateway/model"
import { DualChannelDiagnostics } from "../../src/gateway/publisher"
import type { SynthesisResult } from "../../src/synth/types"

const URI = "file:///p/pipelines/orders/index.tsx"

/** A minimal ok synthesis state — errors map via the file-top fallback. */
function makeState(statements: string[], version = 1): DocumentSynthState {
  const result = {
    ok: true,
    statements,
    sql: statements.join("\n"),
    diagnostics: [],
    statementOrigins: [],
    statementContributors: [],
    statementMeta: [],
    edges: [],
    dagEdges: [],
    changelogModes: [],
    sinkChangelogAccepts: [],
    nodeInputSchemas: [],
    parallelism: null,
    tableSchemas: [],
    pipelineManifest: null,
    tapManifest: null,
    crdYaml: "",
    pipelineKind: "standard",
    artifacts: [],
    nodes: [],
  } as SynthesisResult
  return {
    uri: URI,
    version,
    result,
    positionMap: { map: new Map(), propRanges: new Map(), fromLoc: false },
  }
}

interface Harness {
  coordinator: GatewayCoordinator
  validateCalls: { statements: readonly string[]; signal: AbortSignal }[]
  warnings: string[]
  states: GatewayState[]
  published: Diagnostic[][]
  disposed: () => number
  setState: (s: DocumentSynthState | undefined) => void
  setConfig: (c: Partial<GatewayConfig>) => void
  progressCount: () => number
}

const ENABLED: GatewayConfig = {
  ...DEFAULT_GATEWAY,
  enabled: true,
  endpoint: "http://gw:8083",
}

/** Build a coordinator over scripted deps. `script` decides each validate. */
function harness(
  script: (
    call: number,
    signal: AbortSignal,
  ) => Promise<DeepValidateOutcome> | DeepValidateOutcome,
  initial?: Partial<GatewayConfig>,
): Harness {
  let config: GatewayConfig = { ...ENABLED, ...initial }
  let state: DocumentSynthState | undefined = makeState(["SELECT 1"])
  const validateCalls: Harness["validateCalls"] = []
  const warnings: string[] = []
  const states: GatewayState[] = []
  const published: Diagnostic[][] = []
  let disposeCount = 0
  let progressCount = 0
  const validator: GatewayValidatorLike = {
    validate: (_endpoint, statements, signal) => {
      validateCalls.push({ statements, signal })
      return Promise.resolve(script(validateCalls.length, signal))
    },
    dispose: () => {
      disposeCount += 1
      return Promise.resolve()
    },
  }
  const coordinator = new GatewayCoordinator({
    getConfig: () => config,
    getTargetFlinkVersion: () => undefined,
    getState: () => state,
    publisher: new DualChannelDiagnostics((_uri, diags) => {
      published.push(diags)
    }),
    validator,
    notifyState: (s) => states.push(s),
    showWarning: (m) => warnings.push(m),
    log: () => {},
    beginProgress: () => {
      progressCount += 1
      return Promise.resolve({ done: () => {} })
    },
  })
  return {
    coordinator,
    validateCalls,
    warnings,
    states,
    published,
    disposed: () => disposeCount,
    setState: (s) => {
      state = s
    },
    setConfig: (c) => {
      config = { ...config, ...c }
    },
    progressCount: () => progressCount,
  }
}

const ok = (
  errors: { statementIndex: number; message: string }[] = [],
): DeepValidateOutcome => ({ kind: "ok", errors })

describe("GatewayCoordinator gating", () => {
  it("1.2/6.3 disabled short-circuits: no validator call, no diagnostics", async () => {
    const h = harness(() => ok(), { enabled: false })
    const response = await h.coordinator.runPass(URI)
    expect(response).toEqual({
      uri: URI,
      status: "skipped",
      skipReason: "disabled",
    })
    expect(h.validateCalls).toHaveLength(0)
    expect(h.published).toHaveLength(0)
  })

  it("1.3 enabled without an endpoint is misconfigured: one notice, no connection", async () => {
    const h = harness(() => ok(), { endpoint: "  " })
    const first = await h.coordinator.runPass(URI)
    const second = await h.coordinator.runPass(URI)
    expect(first.skipReason).toBe("misconfigured")
    expect(second.skipReason).toBe("misconfigured")
    expect(h.validateCalls).toHaveLength(0)
    expect(h.warnings).toHaveLength(1) // deduped
    expect(h.states).toContain("error")
  })

  it("skips when nothing is synthesized for the document", async () => {
    const h = harness(() => ok())
    h.setState(undefined)
    const response = await h.coordinator.runPass(URI)
    expect(response.skipReason).toBe("no-synthesis")
  })
})

describe("GatewayCoordinator passes", () => {
  it("a clean pass clears the gateway half and reports idle", async () => {
    const h = harness(() => ok())
    const response = await h.coordinator.runPass(URI)
    expect(response.status).toBe("clean")
    expect(h.states).toEqual(["validating", "idle"])
    expect(h.progressCount()).toBe(1)
  })

  it("planner errors publish FR-GATEWAY diagnostics", async () => {
    const h = harness(() => ({
      kind: "ok",
      errors: [{ statementIndex: 0, message: "Object 'x' not found" }],
    }))
    const response = await h.coordinator.runPass(URI)
    expect(response.status).toBe("errors")
    expect(response.errorCount).toBe(1)
    const last = h.published[h.published.length - 1]
    expect(last).toHaveLength(1)
    expect(last[0].code).toBe("FR-GATEWAY-001")
  })

  it("7.4 a cache hit serves the verdict without re-submitting EXPLAIN", async () => {
    const h = harness(() => ok())
    await h.coordinator.runPass(URI)
    const second = await h.coordinator.runPass(URI)
    expect(h.validateCalls).toHaveLength(1)
    expect(second.fromCache).toBe(true)
    expect(second.status).toBe("clean")
  })

  it("7.4 different SQL misses the cache and re-validates", async () => {
    const h = harness(() => ok())
    await h.coordinator.runPass(URI)
    h.setState(makeState(["SELECT 2"], 2))
    await h.coordinator.runPass(URI)
    expect(h.validateCalls).toHaveLength(2)
  })

  it("7.3 a newer pass supersedes the in-flight one; only the newest publishes", async () => {
    const h = harness((call, signal) => {
      if (call === 1) {
        // Hang until aborted by the superseding pass (which may abort before
        // this even runs — the real validator checks the signal up front too).
        if (signal.aborted) return { kind: "aborted" }
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve({ kind: "aborted" }))
        })
      }
      return {
        kind: "ok",
        errors: [{ statementIndex: 0, message: "from pass 2" }],
      }
    })
    const first = h.coordinator.runPass(URI)
    const second = await h.coordinator.runPass(URI)
    expect((await first).skipReason).toBe("superseded")
    expect(second.status).toBe("errors")
    expect(h.validateCalls[0].signal.aborted).toBe(true)
  })

  it("7.4 a result whose SQL no longer matches the document is discarded", async () => {
    const h = harness(() => {
      // The document moves on (different SQL) while the pass is in flight.
      h.setState(makeState(["SELECT 99"], 2))
      return ok()
    })
    const response = await h.coordinator.runPass(URI)
    expect(response.skipReason).toBe("superseded")
    expect(h.published).toHaveLength(0)
  })
})

describe("GatewayCoordinator degradation", () => {
  it("8.1/8.5 unreachable: one deduped notice, error state, gateway half cleared", async () => {
    const h = harness(() => ({ kind: "unreachable", message: "ECONNREFUSED" }))
    const first = await h.coordinator.runPass(URI)
    const second = await h.coordinator.runPass(URI)
    expect(first.status).toBe("failed")
    expect(second.status).toBe("failed")
    expect(h.warnings).toHaveLength(1) // deduped across consecutive failures
    expect(h.states.filter((s) => s === "error")).toHaveLength(2)
  })

  it("8.1 a recovery re-arms the failure notice", async () => {
    let fail = true
    const h = harness(() =>
      fail ? { kind: "unreachable", message: "down" } : ok(),
    )
    await h.coordinator.runPass(URI)
    fail = false
    h.setState(makeState(["SELECT 2"], 2)) // miss the cache
    await h.coordinator.runPass(URI)
    fail = true
    h.setState(makeState(["SELECT 3"], 3))
    await h.coordinator.runPass(URI)
    expect(h.warnings).toHaveLength(2)
  })

  it("8.2/8.5 timeout: abandoned pass, clear notice, stays responsive", async () => {
    const h = harness(
      (_call, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve({ kind: "aborted" }))
        }),
      { timeoutMs: 20 },
    )
    const response = await h.coordinator.runPass(URI)
    expect(response.status).toBe("failed")
    expect(response.message).toContain("timed out")
    expect(h.warnings).toHaveLength(1)
    // Still serviceable afterwards.
    h.setConfig({ timeoutMs: 30000 })
    const again = harness(() => ok())
    expect((await again.coordinator.runPass(URI)).status).toBe("clean")
  })

  it("8.3 disabling clears every gateway diagnostic and closes the session", async () => {
    const h = harness(() => ({
      kind: "ok",
      errors: [{ statementIndex: 0, message: "x" }],
    }))
    await h.coordinator.runPass(URI)
    expect(h.published[h.published.length - 1]).toHaveLength(1)
    h.setConfig({ enabled: false })
    h.coordinator.onConfigChanged(ENABLED, { ...ENABLED, enabled: false })
    expect(h.published[h.published.length - 1]).toHaveLength(0)
    expect(h.disposed()).toBe(1)
    expect(h.states[h.states.length - 1]).toBe("disabled")
  })

  it("an endpoint change drops the session and the cache", async () => {
    const h = harness(() => ok())
    await h.coordinator.runPass(URI)
    h.coordinator.onConfigChanged(ENABLED, {
      ...ENABLED,
      endpoint: "http://other:8083",
    })
    expect(h.disposed()).toBe(1)
    h.setConfig({ endpoint: "http://other:8083" })
    await h.coordinator.runPass(URI) // would be a cache hit without the drop
    expect(h.validateCalls).toHaveLength(2)
  })
})
