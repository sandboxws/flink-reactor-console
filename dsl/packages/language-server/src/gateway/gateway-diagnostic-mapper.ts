// Gateway-error → LSP diagnostic projection (gateway-validation, Tier-3
// feature 11).
//
// Gateway diagnostics are deliberately **source-isolated** from the Tier-1
// static set: they carry `source: "flink-reactor-gateway"` (never the static
// `"flink-reactor"`) and `FR-GATEWAY-`-prefixed codes (a reserved range that
// no `FR-{CATEGORY}-` static code can collide with), so a planner finding is
// always distinguishable from a static one and the two sets clear on their
// own cadences.

import {
  type Diagnostic,
  DiagnosticSeverity,
  type Range,
} from "vscode-languageserver"
import type { PositionMap } from "../mappers/source-position-mapper.js"
import type { SynthesisResult } from "../synth/types.js"
import type { GatewayStatementError } from "./deep-validate.js"
import { resolveGatewayRange } from "./gateway-range-resolver.js"

/** The diagnostic `source` for every gateway finding — distinct from the
 *  static set's `"flink-reactor"` so neither pass clears the other's. */
export const GATEWAY_DIAGNOSTIC_SOURCE = "flink-reactor-gateway"

/** The reserved code range for gateway findings. One canonical code today
 *  (planner rejection); the remaining numbers are reserved for future
 *  sub-classification, mirroring the static `FR-{CATEGORY}-0xx` convention. */
export const GATEWAY_CODE_PREFIX = "FR-GATEWAY-"

/** Planner rejected a statement (`EXPLAIN` failed). */
export const GATEWAY_PLANNER_CODE = "FR-GATEWAY-001"

/** Structured payload stamped on `Diagnostic.data` for later consumers. */
export interface GatewayDiagnosticData {
  readonly statementIndex: number
  /** Which resolution step placed the range (`origin`/`contributor`/`file-top`). */
  readonly via: "origin" | "contributor" | "file-top"
  readonly nodeId?: string
  /** Extracted root cause from the planner's error chain, when parseable. */
  readonly rootCause?: string
  /** Full planner error text (message + causes) for detail views. */
  readonly fullMessage?: string
}

/** Build the LSP diagnostics for one pass's planner errors. */
export function toGatewayDiagnostics(
  errors: readonly GatewayStatementError[],
  result: SynthesisResult,
  positionMap: PositionMap,
): Diagnostic[] {
  return errors.map((error) => {
    const resolved = resolveGatewayRange(
      error.statementIndex,
      result,
      positionMap,
    )
    const data: GatewayDiagnosticData = {
      statementIndex: error.statementIndex,
      via: resolved.via,
      ...(resolved.nodeId ? { nodeId: resolved.nodeId } : {}),
      ...(error.detail?.rootCause ? { rootCause: error.detail.rootCause } : {}),
      ...(error.detail?.fullMessage
        ? { fullMessage: error.detail.fullMessage }
        : {}),
    }
    return {
      range: resolved.range as Range,
      severity: DiagnosticSeverity.Error,
      source: GATEWAY_DIAGNOSTIC_SOURCE,
      code: GATEWAY_PLANNER_CODE,
      message: gatewayMessage(error, resolved.via),
      data,
    }
  })
}

/** The diagnostic message: the planner's own words, statement-referenced when
 *  the range could not land on the originating JSX (so a file-top diagnostic
 *  still tells the author exactly which statement failed). */
function gatewayMessage(
  error: GatewayStatementError,
  via: GatewayDiagnosticData["via"],
): string {
  const planner = error.detail?.rootCause ?? error.message
  return via === "file-top"
    ? `Flink planner rejected statement #${error.statementIndex + 1}: ${planner}`
    : `Flink planner: ${planner}`
}
