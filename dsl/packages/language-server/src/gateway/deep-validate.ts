// The deep-validation pass (gateway-validation, Tier-3 feature 11).
//
// Submits the synthesized statements of one document to a Flink SQL Gateway
// via `EXPLAIN` — the exact transport `fr --deep-validate` uses (the DSL's
// `SqlGatewayClient`, re-exported from `@flink-reactor/dsl/node`) — and
// collects per-statement planner errors with their statement index intact, so
// the mapper can land each error on the JSX that produced the SQL.
//
// Session lifecycle: one gateway session is opened lazily on the first
// enabled pass and reused for the workspace lifetime (closed on `shutdown`
// or when the endpoint changes). Only `EXPLAIN` is ever submitted — read-only
// intent, mirroring the CLI deep-validate path.
//
// Not plannable, therefore skipped: comment-only banner statements and the
// synthetic `SET`/`STATEMENT SET` wrappers codegen emits around the real DDL
// and DML.

import {
  SqlGatewayClient,
  type StatementErrorDetail,
  StatementExecutionError,
} from "@flink-reactor/dsl/node"

/** The slice of `SqlGatewayClient` a pass consumes — structural, so unit
 *  tests stub the gateway without a network. */
export interface GatewayClientLike {
  openSession(
    config?: { properties?: Record<string, string> },
    signal?: AbortSignal,
  ): Promise<string>
  explainInSession(
    sessionHandle: string,
    dml: string,
    signal?: AbortSignal,
  ): Promise<string>
  closeSession(sessionHandle: string, signal?: AbortSignal): Promise<void>
}

/** One planner rejection, attributed to the statement that caused it. */
export interface GatewayStatementError {
  /** Index into the synthesized `statements` array. */
  readonly statementIndex: number
  /** Primary (first-line) planner message. */
  readonly message: string
  /** Structured gateway detail when available (full message, root cause). */
  readonly detail?: StatementErrorDetail
}

export type DeepValidateOutcome =
  | { readonly kind: "ok"; readonly errors: readonly GatewayStatementError[] }
  | { readonly kind: "unreachable"; readonly message: string }
  | { readonly kind: "timeout"; readonly message: string }
  | { readonly kind: "aborted" }

/** The validator surface the coordinator consumes — structural, so tests can
 *  drive passes with a scripted fake. */
export interface GatewayValidatorLike {
  validate(
    endpoint: string,
    statements: readonly string[],
    signal: AbortSignal,
  ): Promise<DeepValidateOutcome>
  dispose(): Promise<void>
}

/** A statement the planner can't take: a `--` comment banner, a synthetic
 *  `SET` config statement, or a `STATEMENT SET` wrapper. */
export function isSkippableStatement(sql: string): boolean {
  const lines = sql.split("\n").map((l) => l.trim())
  if (lines.every((l) => l === "" || l.startsWith("--"))) return true
  const first = lines.find((l) => l !== "" && !l.startsWith("--")) ?? ""
  return /^SET\s/i.test(first) || /^(EXECUTE\s+)?STATEMENT\s+SET\b/i.test(first)
}

/**
 * Owns the lazy, reusable gateway session and runs `EXPLAIN` passes against
 * it. Pure transport — no LSP types, no diagnostics; the coordinator handles
 * cancellation policy, caching, and publishing.
 */
export class GatewayValidator {
  private session: string | undefined
  private client: GatewayClientLike | undefined
  private endpoint = ""

  constructor(
    private readonly makeClient: (endpoint: string) => GatewayClientLike = (
      endpoint,
    ) => new SqlGatewayClient(endpoint),
  ) {}

  /**
   * Run one pass: `EXPLAIN` every plannable statement, collecting planner
   * errors (never throwing them). A connection-level failure resolves as
   * `unreachable`/`timeout`; an abort resolves as `aborted`. Statement order
   * is preserved so indices stay aligned with the synthesized array.
   */
  async validate(
    endpoint: string,
    statements: readonly string[],
    signal: AbortSignal,
  ): Promise<DeepValidateOutcome> {
    let session: string
    try {
      session = await this.ensureSession(endpoint, signal)
    } catch (err) {
      return this.asConnectionFailure(err, signal)
    }

    const errors: GatewayStatementError[] = []
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i]
      if (isSkippableStatement(sql)) continue
      if (signal.aborted) return { kind: "aborted" }
      try {
        // `explainInSession` prepends `EXPLAIN ` itself.
        await (this.client as GatewayClientLike).explainInSession(
          session,
          sql,
          signal,
        )
      } catch (err) {
        if (err instanceof StatementExecutionError) {
          errors.push({
            statementIndex: i,
            message: err.detail.message,
            detail: err.detail,
          })
          continue
        }
        // Anything else is a transport/session failure — the session may be
        // stale (gateway restarted); drop it so the next pass reopens.
        this.session = undefined
        return this.asConnectionFailure(err, signal)
      }
    }
    return { kind: "ok", errors }
  }

  /** Close the workspace session (best-effort; `shutdown`/endpoint change). */
  async dispose(): Promise<void> {
    const { client, session } = this
    this.session = undefined
    this.client = undefined
    if (client && session) {
      try {
        await client.closeSession(session)
      } catch {
        // Best-effort: the gateway's idle timeout reaps it otherwise.
      }
    }
  }

  /** Lazily open (or reuse) the workspace session for `endpoint`. */
  private async ensureSession(
    endpoint: string,
    signal: AbortSignal,
  ): Promise<string> {
    if (this.session && this.endpoint === endpoint) return this.session
    // Endpoint changed (or first use): drop any old session first.
    if (this.session) await this.dispose()
    this.endpoint = endpoint
    this.client = this.makeClient(endpoint)
    this.session = await this.client.openSession(undefined, signal)
    return this.session
  }

  private asConnectionFailure(
    err: unknown,
    signal: AbortSignal,
  ): DeepValidateOutcome {
    if (signal.aborted) return { kind: "aborted" }
    const message = err instanceof Error ? err.message : String(err)
    return /did not complete within/i.test(message)
      ? { kind: "timeout", message }
      : { kind: "unreachable", message }
  }
}
