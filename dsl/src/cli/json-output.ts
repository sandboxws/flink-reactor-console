// ── Machine-readable command output ──────────────────────────────────
// Shared envelope for `--json` modes (`validate --json`, `synth --json`).
//
// Contract with consumers (flink-reactor-console, CI):
//   - stdout carries exactly one JSON document and nothing else; all
//     human/progress output is suppressed in JSON mode.
//   - The envelope is versioned via `formatVersion`. Evolution is
//     additive-only within a version; any breaking change (rename,
//     removal, semantics change) bumps `JSON_FORMAT_VERSION`.
//   - Exit codes: 0 = ok (warnings allowed), 1 = validation errors or
//     command failure. The envelope is still emitted on failure.

import type { ValidationDiagnostic } from "@/core/synth-context.js"
import { DSL_VERSION } from "./templates/shared.js"

export const JSON_FORMAT_VERSION = 1

// ── Error serialization ──────────────────────────────────────────────

/** A tagged SynthError (or unexpected defect) flattened for transport. */
export interface SerializedError {
  /** `_tag` of the typed error, or `"Defect"` for unexpected throws. */
  readonly tag: string
  readonly message: string
  /** Remaining error fields (reason, path, diagnostics, …), verbatim. */
  readonly context: Readonly<Record<string, unknown>>
}

/**
 * Flatten a typed error (anything carrying `_tag`) or unknown defect into
 * a `SerializedError`. Tagged errors keep their non-message fields in
 * `context`; `ValidationError` (which has no `message` field) gets a
 * stable fallback message with its diagnostics in `context.diagnostics`.
 */
export function serializeSynthError(err: unknown): SerializedError {
  if (typeof err === "object" && err !== null && "_tag" in err) {
    const bag = err as Record<string, unknown>
    const context: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(bag)) {
      if (key === "_tag" || key === "message" || key === "stack") continue
      context[key] = value
    }
    const message =
      typeof bag.message === "string" && bag.message.length > 0
        ? bag.message
        : String(bag._tag) === "ValidationError"
          ? "validation failed"
          : String(bag._tag)
    return { tag: String(bag._tag), message, context }
  }
  if (err instanceof Error) {
    return { tag: "Defect", message: err.message, context: {} }
  }
  return { tag: "Defect", message: String(err), context: {} }
}

// ── Envelope ─────────────────────────────────────────────────────────

interface JsonEnvelopeBase {
  readonly formatVersion: typeof JSON_FORMAT_VERSION
  readonly tool: { readonly name: "flink-reactor"; readonly version: string }
  readonly command: "validate" | "synth"
  /** False when validation errors exist or the command itself failed. */
  readonly ok: boolean
  readonly startedAt: string
  readonly durationMs: number
  /** Non-diagnostic warnings (e.g. tap-manifest push failures). */
  readonly warnings: readonly string[]
  /** Present when the command failed with a typed error or defect. */
  readonly error?: SerializedError
}

export interface PipelineValidationJson {
  readonly name: string
  readonly ok: boolean
  readonly errors: readonly ValidationDiagnostic[]
  readonly warnings: readonly ValidationDiagnostic[]
}

export interface ValidateJsonOutput extends JsonEnvelopeBase {
  readonly command: "validate"
  readonly pipelines: readonly PipelineValidationJson[]
}

export type SynthFileKind =
  | "sql"
  | "deployment"
  | "configmap"
  | "pipeline-yaml"
  | "tap-manifest"
  | "secondary-resource"

export interface SynthArtifactFileJson {
  readonly kind: SynthFileKind
  /** Absolute path of the written file. */
  readonly path: string
}

export interface SynthPipelineJson {
  readonly name: string
  readonly statementCount: number
  /**
   * SQL-verifier diagnostics carried on the artifact. Synth does not fail
   * on these (parity with human mode, which writes artifacts regardless);
   * consumers decide their own gate.
   */
  readonly diagnostics: readonly ValidationDiagnostic[]
  readonly files: readonly SynthArtifactFileJson[]
}

export interface SynthJsonOutput extends JsonEnvelopeBase {
  readonly command: "synth"
  readonly outDir: string
  readonly pipelines: readonly SynthPipelineJson[]
}

/** Tool identity stamped on every envelope. */
export function jsonToolInfo(): JsonEnvelopeBase["tool"] {
  return { name: "flink-reactor", version: DSL_VERSION }
}

/** Write the envelope to stdout — the only stdout bytes in JSON mode. */
export function emitJson(envelope: ValidateJsonOutput | SynthJsonOutput): void {
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
}
