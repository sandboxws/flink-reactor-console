// `toLspDiagnostic` — the single projection from a synthesis `ValidationDiagnostic`
// to an LSP `Diagnostic`. Pure and deterministic: code from `category`,
// severity a total projection, range + cross-node links from the position map,
// message enriched from `details` (did-you-mean), and the structured `details`
// re-stamped on `Diagnostic.data` for a later code-action capability.

import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import type { ValidationDiagnostic } from "../synth/types.js"
import { codeForCategory, DIAGNOSTIC_SOURCE } from "./codes.js"
import { nearestCandidate } from "./did-you-mean.js"
import type { MapperContext } from "./mapper-context.js"
import { buildRelatedInformation, resolveRange } from "./range-resolver.js"

/** The stable shape stamped on `Diagnostic.data` so a future code-action
 *  capability (rename-to-column, add-missing-prop, …) can consume findings
 *  without re-parsing the message. */
export interface DiagnosticData {
  readonly category?: string
  readonly nodeId?: string
  readonly component?: string
  /** Schema findings: the nearest column suggestion + the full candidate set. */
  readonly didYouMean?: string
  readonly referencedColumn?: string
  readonly availableColumns?: readonly string[]
  /** Connector findings: the props the author must supply. */
  readonly missingProps?: readonly string[]
  /** Changelog findings: the two endpoints of the violation. */
  readonly sourceNodeId?: string
  readonly sinkNodeId?: string
  /** Structure findings: every other node implicated (cycle members). */
  readonly relatedNodeIds?: readonly string[]
}

/** Total severity projection — `error` → Error, `warning` → Warning. No
 *  Information/Hint levels are produced (design decision). */
export function lspSeverity(
  severity: ValidationDiagnostic["severity"],
): DiagnosticSeverity {
  return severity === "error"
    ? DiagnosticSeverity.Error
    : DiagnosticSeverity.Warning
}

export function toLspDiagnostic(
  finding: ValidationDiagnostic,
  ctx: MapperContext,
): Diagnostic {
  const { range, fellBackToFileTop } = resolveRange(finding, ctx)
  const suggestion = didYouMean(finding)

  let message = finding.message
  if (suggestion) message += `; did you mean \`${suggestion}\`?`
  if (fellBackToFileTop && finding.nodeId) {
    message += ` (node: ${finding.nodeId})`
  }

  const diagnostic: Diagnostic = {
    range,
    severity: lspSeverity(finding.severity),
    code: codeForCategory(finding.category),
    source: DIAGNOSTIC_SOURCE,
    message,
    data: buildData(finding, suggestion),
  }

  const related = buildRelatedInformation(finding, ctx)
  if (related) diagnostic.relatedInformation = related

  return diagnostic
}

/** Compute the did-you-mean suggestion for a schema finding (or `undefined`). */
function didYouMean(finding: ValidationDiagnostic): string | undefined {
  if (finding.category !== "schema") return undefined
  const { referencedColumn, availableColumns } = finding.details ?? {}
  if (!referencedColumn || !availableColumns?.length) return undefined
  return nearestCandidate(referencedColumn, availableColumns)?.candidate
}

function buildData(
  finding: ValidationDiagnostic,
  suggestion: string | undefined,
): DiagnosticData {
  const d = finding.details
  return {
    category: finding.category,
    nodeId: finding.nodeId,
    component: finding.component,
    didYouMean: suggestion,
    referencedColumn: d?.referencedColumn,
    availableColumns: d?.availableColumns,
    missingProps: d?.missingProps,
    sourceNodeId: d?.sourceNodeId,
    sinkNodeId: d?.sinkNodeId,
    relatedNodeIds: d?.relatedNodeIds,
  }
}
