// Shared context and helpers for the diagnostic-driven quick-fix builders
// (component-refactoring, Tier-3 feature 14).
//
// Every fix is a small, total function from (diagnostic, current text) to a
// `CodeAction` or nothing: it re-locates its literal target in the *current*
// parse before offering an edit, so a stale diagnostic (computed against an
// older document version) degrades to "no action" rather than a wrong-span
// edit.

import ts from "typescript"
import type { DiagnosticData } from "../../diagnostics/diagnostic-mapper.js"
import type { DocumentSynthState } from "../../document-state.js"
import { elementAtRangeStart } from "../../providers/definition/binding.js"
import type { OffsetEdit, OpeningTag } from "../safety.js"

export interface FixContext {
  readonly state: DocumentSynthState
  readonly sf: ts.SourceFile
  readonly sourceText: string
  readonly uri: string
}

/** Narrow a diagnostic's `data` back to the shape the Tier-1 mapper stamped. */
export function diagnosticData(data: unknown): DiagnosticData | undefined {
  if (typeof data !== "object" || data === null) return undefined
  return data as DiagnosticData
}

/** The JSX opening element for a synthesized node, re-located in the current
 *  parse via the source-position map — `undefined` when the node is unmapped
 *  or the text drifted (then no fix is offered). */
export function elementForNode(
  ctx: FixContext,
  nodeId: string | undefined,
): OpeningTag | undefined {
  if (!nodeId) return undefined
  const range = ctx.state.positionMap.map.get(nodeId)
  if (!range) return undefined
  return elementAtRangeStart(ctx.sf, range)
}

/** The component (tag) name of a synthesized node. */
export function componentOf(
  ctx: FixContext,
  nodeId: string | undefined,
): string | undefined {
  if (!nodeId) return undefined
  return ctx.state.result.nodes.find((n) => n.id === nodeId)?.component
}

/**
 * Extend the document's `@flink-reactor/dsl` named-import list with any of
 * `names` not already imported, or insert a fresh import when none exists.
 * Returns `null` when nothing is missing. (The author's formatter owns member
 * ordering; the edit appends before the closing brace.)
 */
export function ensureDslImport(
  sf: ts.SourceFile,
  names: readonly string[],
): OffsetEdit | null {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue
    if (stmt.moduleSpecifier.text !== "@flink-reactor/dsl") continue
    const bindings = stmt.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    const present = new Set(bindings.elements.map((e) => e.name.text))
    const missing = names.filter((n) => !present.has(n))
    if (missing.length === 0) return null
    const last = bindings.elements[bindings.elements.length - 1]
    if (!last) return null
    return {
      start: last.getEnd(),
      end: last.getEnd(),
      newText: `, ${missing.join(", ")}`,
    }
  }
  // No DSL import at all — prepend one (a pipeline document always has one in
  // practice; this is the defensive branch).
  return {
    start: 0,
    end: 0,
    newText: `import { ${names.join(", ")} } from "@flink-reactor/dsl"\n`,
  }
}
