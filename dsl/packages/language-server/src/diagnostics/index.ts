// The diagnostics publishing orchestrator. Projects a decoded `SynthesisResult`
// + its source-position map into the full LSP `Diagnostic[]` that the server
// publishes (replace-on-change). Every validation finding is mapped through
// `toLspDiagnostic`; a load/synth failure and an approximate position map are
// surfaced as their own FR-coded diagnostics.
//
// Only `FR`-prefixed codes are emitted — TypeScript type errors stay with
// `tsserver`, and nothing collides with the ts-plugin nesting code (90100).

import {
  type Diagnostic,
  DiagnosticSeverity,
  type Range,
} from "vscode-languageserver"
import type { PositionMap } from "../mappers/source-position-mapper.js"
import type { SynthesisResult } from "../synth/types.js"
import { DIAGNOSTIC_SOURCE } from "./codes.js"
import { toLspDiagnostic } from "./diagnostic-mapper.js"
import type { MapperContext } from "./mapper-context.js"
import { FILE_TOP_RANGE } from "./range-resolver.js"

export {
  codeForCategory,
  DIAGNOSTIC_CODE_TABLE,
  isFlinkReactorCode,
  TS_PLUGIN_NESTING_CODE,
} from "./codes.js"
export { toLspDiagnostic } from "./diagnostic-mapper.js"
export type { MapperContext } from "./mapper-context.js"

/**
 * Convert a decoded synthesis result + its source-position map into the LSP
 * diagnostics for a document.
 */
export function toLspDiagnostics(
  result: SynthesisResult,
  ctx: MapperContext,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const finding of result.diagnostics) {
    diagnostics.push(toLspDiagnostic(finding, ctx))
  }

  if (result.loadError) {
    diagnostics.push({
      range: FILE_TOP_RANGE,
      severity: DiagnosticSeverity.Error,
      code: `FR-${result.loadError.kind.toUpperCase()}`,
      source: DIAGNOSTIC_SOURCE,
      message: result.loadError.message,
    })
  }

  if (ctx.positionMap.mismatch) {
    diagnostics.push({
      range: FILE_TOP_RANGE as Range,
      severity: DiagnosticSeverity.Warning,
      code: "FR-MAP-MISMATCH",
      source: DIAGNOSTIC_SOURCE,
      message: ctx.positionMap.mismatch.message,
    })
  }

  return diagnostics
}

/** Convenience builder so callers don't assemble the context inline. */
export function mapperContext(
  positionMap: PositionMap,
  sourceText: string,
  uri: string,
): MapperContext {
  return { positionMap, sourceText, uri }
}
