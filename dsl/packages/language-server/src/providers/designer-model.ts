// `flinkReactor/designerModel` assembler (visual-designer, section 2).
//
// A superset of the `dag-visualization` graph model: the same nodes/edges/
// kinds/labels/diagnostics projection (`buildGraphModel` IS the base — one
// rendering contract for both webviews), plus per node the editability
// classification of every prop (from the `.tsx` AST) and the document's file
// kind for the edit-safety matrix. Pure projection of held state + source
// text — no synthesis, no DSL objects, plain JSON out.

import type {
  DesignerModelNode,
  DesignerModelResponse,
  DesignerPropEntry,
} from "../designer/model.js"
import { classifyNodeProps } from "../designer/prop-classifier.js"
import { resolveFileKind } from "../designer/static-subset.js"
import type { SourceRange, SynthesisResult } from "../synth/types.js"
import { buildGraphModel } from "./graph-model.js"

/**
 * Build the designer model for a synthesized document. Never throws: a failed
 * synthesis becomes an `ok: false` envelope (file kind still resolved from the
 * source text so the canvas can keep affordances honest while dimmed).
 */
export function buildDesignerModel(
  uri: string,
  version: number,
  result: SynthesisResult,
  sourceText: string,
): DesignerModelResponse {
  const { fileKind, fileKindReason } = resolveFileKind(sourceText, uri)
  const base = buildGraphModel(uri, version, result)
  if (!base.ok) {
    return {
      uri,
      version,
      ok: false,
      error: base.error,
      fileKind,
      ...(fileKindReason ? { fileKindReason } : {}),
      nodes: [],
      edges: [],
      statements: [],
    }
  }

  const classified = classifyNodeProps(sourceText, uri, result.nodes)
  const nodes: DesignerModelNode[] = base.nodes.map((n) => ({
    ...n,
    props: scrub(classified.get(n.id) ?? []),
  }))

  return {
    uri,
    version,
    ok: true,
    fileKind,
    ...(fileKindReason ? { fileKindReason } : {}),
    nodes,
    edges: base.edges,
    statements: base.statements,
  }
}

/** Re-shape each entry through plain JSON so no AST/DSL reference can leak
 *  (task 2.6) — the wire payload must be primitives/arrays/objects only. */
function scrub(
  entries: readonly DesignerPropEntry[],
): readonly DesignerPropEntry[] {
  return entries.map((e) => ({
    name: e.name,
    classification: e.classification,
    ...(e.value !== undefined ? { value: jsonClone(e.value) } : {}),
    ...(e.valueKind !== undefined ? { valueKind: e.valueKind } : {}),
    ...(e.range !== undefined ? { range: cloneRange(e.range) } : {}),
  }))
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneRange(range: SourceRange): SourceRange {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  }
}
