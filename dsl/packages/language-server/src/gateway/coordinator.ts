// Pass orchestration for gateway validation (Tier-3 feature 11).
//
// Sits between the LSP transport (server.ts wires the request, save hook,
// progress, notices) and the pure pieces (validator → errors, resolver/mapper
// → diagnostics, dual-channel publisher). Owns the policies:
//
//   gating        — every path short-circuits while `gateway.enabled` is
//                   false; enabled-without-endpoint is "misconfigured" (one
//                   clear notice, no connection attempt).
//   cancellation  — one in-flight pass per document; a newer pass aborts the
//                   older, whose result is discarded (`superseded`).
//   caching       — results are keyed by `hash(statements)`: the generated
//                   SQL is a pure function of the source, so identical SQL
//                   reuses the cached planner verdict with no `EXPLAIN`.
//                   Cached errors are re-mapped against the *current*
//                   position map, so ranges stay correct across SQL-neutral
//                   edits. Only verdicts are cached — connection failures
//                   always retry.
//   staleness     — a pass publishes only if the document's current synthesis
//                   still hashes to what the pass validated.
//   degradation   — unreachable/timeout produce one non-modal notice (deduped
//                   per failure state), a gateway-state notification, and a
//                   cleared gateway set; static diagnostics and authoring are
//                   never touched.

import { createHash } from "node:crypto"
import type { GatewayConfig } from "../config.js"
import type { DocumentSynthState } from "../document-state.js"
import type {
  DeepValidateOutcome,
  GatewayStatementError,
  GatewayValidatorLike,
} from "./deep-validate.js"
import { toGatewayDiagnostics } from "./gateway-diagnostic-mapper.js"
import type { DeepValidateResponse, GatewayState } from "./model.js"
import type { DualChannelDiagnostics } from "./publisher.js"

/** Most recent successful verdicts, keyed by SQL hash. */
const CACHE_LIMIT = 64

export interface GatewayCoordinatorDeps {
  readonly getConfig: () => GatewayConfig
  /** The pipeline's target Flink version (for the mismatch warning). */
  readonly getTargetFlinkVersion: () => string | undefined
  readonly getState: (uri: string) => DocumentSynthState | undefined
  readonly publisher: DualChannelDiagnostics
  readonly validator: GatewayValidatorLike
  /** `flinkReactor/gatewayState` notification. */
  readonly notifyState: (state: GatewayState, message?: string) => void
  /** Non-modal `window/showMessage` warning. */
  readonly showWarning: (message: string) => void
  /** Server-side log (version-mismatch warnings etc.). */
  readonly log: (message: string) => void
  /** Begin `window/workDoneProgress`; resolves to a `done()` handle. May
   *  reject when the client lacks progress support — that is non-fatal. */
  readonly beginProgress: (title: string) => Promise<{ done(): void }>
}

interface InflightPass {
  readonly controller: AbortController
  timedOut: boolean
  superseded: boolean
}

export class GatewayCoordinator {
  private readonly cache = new Map<string, readonly GatewayStatementError[]>()
  private readonly inflight = new Map<string, InflightPass>()
  /** Last failure notice shown, so repeated failures don't spam. */
  private lastNoticeKey: string | undefined

  constructor(private readonly deps: GatewayCoordinatorDeps) {}

  /** Run one deep-validation pass for `uri` (the explicit command and the
   *  optional on-save trigger both land here). Never throws; never blocks
   *  other LSP traffic (network awaits yield the message loop). */
  async runPass(uri: string): Promise<DeepValidateResponse> {
    const config = this.deps.getConfig()
    if (!config.enabled) {
      return { uri, status: "skipped", skipReason: "disabled" }
    }
    if (config.endpoint.trim() === "") {
      this.noticeOnce(
        "misconfigured",
        "FlinkReactor deep validation is enabled but no SQL Gateway endpoint is configured (flinkReactor.gateway.endpoint).",
      )
      this.deps.notifyState("error", "No gateway endpoint configured")
      return { uri, status: "skipped", skipReason: "misconfigured" }
    }

    const state = this.deps.getState(uri)
    if (!state || !state.result.ok) {
      return { uri, status: "skipped", skipReason: "no-synthesis" }
    }

    const hash = hashStatements(state.result.statements)
    const cached = this.cache.get(hash)
    if (cached) {
      // Re-map against the *current* position map — an SQL-neutral edit may
      // have moved the nodes since the verdict was cached.
      this.publishErrors(uri, cached, state)
      this.deps.notifyState("idle")
      return {
        uri,
        status: cached.length === 0 ? "clean" : "errors",
        ...(cached.length > 0 ? { errorCount: cached.length } : {}),
        fromCache: true,
      }
    }

    this.warnOnVersionMismatch(config)

    // A newer pass supersedes any in-flight one for the same document.
    const previous = this.inflight.get(uri)
    if (previous) {
      previous.superseded = true
      previous.controller.abort()
    }
    const pass: InflightPass = {
      controller: new AbortController(),
      timedOut: false,
      superseded: false,
    }
    this.inflight.set(uri, pass)
    const timer = setTimeout(() => {
      pass.timedOut = true
      pass.controller.abort()
    }, config.timeoutMs)

    this.deps.notifyState("validating")
    const progress = await this.deps
      .beginProgress("FlinkReactor: deep validating pipeline…")
      .catch(() => undefined)

    let outcome: DeepValidateOutcome
    try {
      outcome = await this.deps.validator.validate(
        config.endpoint,
        state.result.statements,
        pass.controller.signal,
      )
    } finally {
      clearTimeout(timer)
      progress?.done()
      if (this.inflight.get(uri) === pass) this.inflight.delete(uri)
    }

    if (pass.superseded || outcome.kind === "aborted") {
      if (pass.timedOut) return this.failPass(uri, "timeout", config)
      return { uri, status: "skipped", skipReason: "superseded" }
    }
    if (outcome.kind === "timeout") {
      return this.failPass(uri, "timeout", config, outcome.message)
    }
    if (outcome.kind === "unreachable") {
      return this.failPass(uri, "unreachable", config, outcome.message)
    }

    // Publish only if the document's SQL is still what this pass validated.
    const current = this.deps.getState(uri)
    if (!current || hashStatements(current.result.statements) !== hash) {
      return { uri, status: "skipped", skipReason: "superseded" }
    }

    this.remember(hash, outcome.errors)
    this.publishErrors(uri, outcome.errors, current)
    this.lastNoticeKey = undefined // recovered — a future failure re-notifies
    this.deps.notifyState("idle")
    return {
      uri,
      status: outcome.errors.length === 0 ? "clean" : "errors",
      ...(outcome.errors.length > 0
        ? { errorCount: outcome.errors.length }
        : {}),
    }
  }

  /** React to a `flinkReactor.gateway.*` settings change. */
  onConfigChanged(previous: GatewayConfig, next: GatewayConfig): void {
    if (previous.enabled && !next.enabled) {
      // Disabled: abort in-flight passes, drop every gateway diagnostic, and
      // close the workspace session. Static diagnostics are untouched.
      for (const pass of this.inflight.values()) {
        pass.superseded = true
        pass.controller.abort()
      }
      this.inflight.clear()
      this.deps.publisher.clearAllGateway()
      void this.deps.validator.dispose()
      this.lastNoticeKey = undefined
      this.deps.notifyState("disabled")
      return
    }
    if (!previous.enabled && next.enabled) {
      this.lastNoticeKey = undefined
      this.deps.notifyState("idle")
    }
    if (previous.endpoint !== next.endpoint) {
      // The session belongs to the old endpoint; the next pass reopens.
      void this.deps.validator.dispose()
      this.cache.clear()
      this.lastNoticeKey = undefined
    }
  }

  /** Shutdown: abort passes and close the gateway session. */
  async dispose(): Promise<void> {
    for (const pass of this.inflight.values()) {
      pass.superseded = true
      pass.controller.abort()
    }
    this.inflight.clear()
    await this.deps.validator.dispose()
  }

  // ── internals ───────────────────────────────────────────────────────

  private publishErrors(
    uri: string,
    errors: readonly GatewayStatementError[],
    state: DocumentSynthState,
  ): void {
    if (errors.length === 0) {
      this.deps.publisher.clearGateway(uri)
      return
    }
    this.deps.publisher.setGateway(
      uri,
      toGatewayDiagnostics(errors, state.result, state.positionMap),
    )
  }

  /** Gateway failure: one deduped notice, error state, gateway set cleared
   *  (stale planner findings must not outlive a dropped gateway), static set
   *  and authoring untouched. */
  private failPass(
    uri: string,
    kind: "unreachable" | "timeout",
    config: GatewayConfig,
    detail?: string,
  ): DeepValidateResponse {
    const message =
      kind === "timeout"
        ? `FlinkReactor deep validation timed out after ${config.timeoutMs}ms (gateway: ${config.endpoint}).`
        : `FlinkReactor deep validation could not reach the SQL Gateway at ${config.endpoint}.${detail ? ` ${detail}` : ""}`
    this.noticeOnce(kind, message)
    this.deps.publisher.clearGateway(uri)
    this.deps.notifyState("error", message)
    return { uri, status: "failed", message }
  }

  /** Show a failure notice once per failure state (reset on recovery or a
   *  config change), so a broken gateway never spams the author. */
  private noticeOnce(kind: string, message: string): void {
    const key = `${kind}:${this.deps.getConfig().endpoint}`
    if (this.lastNoticeKey === key) return
    this.lastNoticeKey = key
    this.deps.showWarning(message)
  }

  private warnOnVersionMismatch(config: GatewayConfig): void {
    const target = this.deps.getTargetFlinkVersion()
    if (
      config.flinkVersion !== undefined &&
      target !== undefined &&
      config.flinkVersion !== target
    ) {
      this.deps.log(
        `Gateway Flink version hint (${config.flinkVersion}) differs from the pipeline target (${target}); EXPLAIN is generally forward-compatible, continuing.`,
      )
    }
  }

  private remember(
    hash: string,
    errors: readonly GatewayStatementError[],
  ): void {
    this.cache.set(hash, errors)
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
  }
}

function hashStatements(statements: readonly string[]): string {
  return createHash("sha256").update(statements.join("\u0000")).digest("hex")
}
