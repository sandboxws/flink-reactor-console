// Range-scoped node selection for inlay hints (schema-inlay-hints, Tier-3
// feature 10).
//
// Inlay-hint requests are viewport-scoped: the client asks for hints covering
// the visible range only. This module answers "which ConstructNodes live in
// that range, and where does each hint anchor?" from the Tier-0 source-position
// map — a pure lookup, no parsing. The map records each node's *opening tag*
// (not its whole subtree), so a node's `range.end` is exactly the spec's
// "opening-tag end" anchor, for `<C …/>`, `<C …>children</C>`, and factory-call
// forms alike.

import type { Range } from "vscode-languageserver"
import type { PositionMap } from "../mappers/source-position-mapper.js"
import type { SourceRange } from "../synth/types.js"

/** A node whose opening tag intersects the requested range. */
export interface SelectedNode {
  readonly nodeId: string
  /** The opening tag's source range (from the position map). */
  readonly range: SourceRange
  /** Where the node's inlay hint anchors: the opening tag's end. */
  readonly anchor: SourceRange["end"]
}

/**
 * Select the nodes whose mapped (opening-tag) range intersects `range`,
 * in document order. Nodes absent from the position map are naturally
 * excluded — the graceful-absence path: their siblings still annotate.
 */
export function selectNodesInRange(
  positionMap: PositionMap,
  range: Range,
): SelectedNode[] {
  const selected: SelectedNode[] = []
  for (const [nodeId, nodeRange] of positionMap.map) {
    if (intersects(nodeRange, range)) {
      selected.push({ nodeId, range: nodeRange, anchor: nodeRange.end })
    }
  }
  selected.sort(
    (a, b) =>
      a.range.start.line - b.range.start.line ||
      a.range.start.character - b.range.start.character,
  )
  return selected
}

/** Closed-interval intersection of two line/character ranges. */
function intersects(a: SourceRange, b: Range): boolean {
  return !(before(a.end, b.start) || before(b.end, a.start))
}

type Pos = { readonly line: number; readonly character: number }

function before(p: Pos, q: Pos): boolean {
  return p.line < q.line || (p.line === q.line && p.character < q.character)
}
