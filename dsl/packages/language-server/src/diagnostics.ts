import {
  type Diagnostic,
  DiagnosticSeverity,
  type Range,
} from "vscode-languageserver"
import type { PositionMap } from "./mappers/source-position-mapper.js"
import type { SynthesisResult, ValidationDiagnostic } from "./synth/types.js"

const SOURCE = "flink-reactor"

/** File-top range used when a diagnostic's node cannot be located in source. */
const FALLBACK_RANGE: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
}

/** Map a validation category to its stable `FR`-prefixed diagnostic code. */
function codeForCategory(category: string | undefined): string {
  switch (category) {
    case "schema":
      return "FR-SCHEMA"
    case "expression":
      return "FR-EXPRESSION"
    case "connector":
      return "FR-CONNECTOR"
    case "changelog":
      return "FR-CHANGELOG"
    case "structure":
      return "FR-STRUCTURE"
    case "sql":
      return "FR-SQL"
    default:
      return "FR-GENERAL"
  }
}

function lspSeverity(
  severity: ValidationDiagnostic["severity"],
): DiagnosticSeverity {
  return severity === "error"
    ? DiagnosticSeverity.Error
    : DiagnosticSeverity.Warning
}

/**
 * Convert a decoded synthesis result + its source-position map into LSP
 * diagnostics.
 *
 * - Validation findings get an `FR`-prefixed code from their category and are
 *   placed at the mapped range for `nodeId` (file top when unmapped).
 * - A load/synth failure becomes a single `FR-<KIND>` error at the file top.
 * - A position-map mismatch is surfaced as a separate `FR-MAP-MISMATCH`
 *   warning so the user knows some ranges are approximate.
 *
 * Only `FR`-prefixed codes are emitted; TypeScript type errors are never
 * duplicated here (those stay with tsserver / the ts-plugin).
 */
export function toLspDiagnostics(
  result: SynthesisResult,
  positionMap: PositionMap,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const d of result.diagnostics) {
    const range =
      (d.nodeId ? positionMap.map.get(d.nodeId) : undefined) ?? FALLBACK_RANGE
    diagnostics.push({
      range: range as Range,
      severity: lspSeverity(d.severity),
      code: codeForCategory(d.category),
      source: SOURCE,
      message: d.message,
    })
  }

  if (result.loadError) {
    diagnostics.push({
      range: FALLBACK_RANGE,
      severity: DiagnosticSeverity.Error,
      code: `FR-${result.loadError.kind.toUpperCase()}`,
      source: SOURCE,
      message: result.loadError.message,
    })
  }

  if (positionMap.mismatch) {
    diagnostics.push({
      range: FALLBACK_RANGE,
      severity: DiagnosticSeverity.Warning,
      code: "FR-MAP-MISMATCH",
      source: SOURCE,
      message: positionMap.mismatch.message,
    })
  }

  return diagnostics
}
