// Hover position → ConstructNode resolution.
//
// The inverse of validation's mapping: validation maps a `nodeId` *to* a
// `Range`; hover maps a hovered `Position` *back to* the smallest mapped
// `ConstructNode` whose source range contains it. Pure lookup over the Tier-0
// source-position map — no parsing, no synthesis.

import type { PositionMap } from "../mappers/source-position-mapper.js"
import type { SourceRange } from "../synth/types.js"

/** A 0-based LSP-style position (`vscode-languageserver` `Position` is
 *  structurally identical, so the provider can pass it directly). */
export type Position = SourceRange["start"]

export interface ResolvedNode {
  readonly nodeId: string
  /** The mapped source range (the node's opening tag). */
  readonly range: SourceRange
}

/**
 * Resolve `position` to the smallest mapped ConstructNode whose source range
 * contains it, or `undefined` when no mapped node covers it (programmatic
 * `createElement`, a position outside any element, or a stale map). "Smallest"
 * disambiguates nested elements — the innermost wins.
 */
export function resolveNodeAt(
  positionMap: PositionMap,
  position: Position,
): ResolvedNode | undefined {
  let best: ResolvedNode | undefined
  for (const [nodeId, range] of positionMap.map) {
    if (!rangeContains(range, position)) continue
    if (!best || isSmaller(range, best.range)) best = { nodeId, range }
  }
  return best
}

/** Whether `position` lies within `[range.start, range.end]` (inclusive ends). */
export function rangeContains(range: SourceRange, position: Position): boolean {
  const { start, end } = range
  if (position.line < start.line || position.line > end.line) return false
  if (position.line === start.line && position.character < start.character)
    return false
  if (position.line === end.line && position.character > end.character)
    return false
  return true
}

/** Order ranges by span so the narrower (more deeply nested) one is preferred. */
function isSmaller(a: SourceRange, b: SourceRange): boolean {
  const aLines = a.end.line - a.start.line
  const bLines = b.end.line - b.start.line
  if (aLines !== bLines) return aLines < bLines
  return (
    a.end.character - a.start.character < b.end.character - b.start.character
  )
}
