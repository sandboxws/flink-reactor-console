// Failing-statement → source-range resolution (gateway-validation, Tier-3
// feature 11).
//
// A planner error is reported against a statement index; the author thinks in
// JSX. The resolution chain is deterministic and never drops an error:
//
//   1. `statementOrigins[index].nodeId` → the source-position map — the exact
//      component that produced the bad SQL (a source/sink's DDL, a DML head).
//   2. No origin (synthetic statement) or unmapped node → the first *mapped*
//      contributor of that statement (`statementContributors` carries every
//      node whose fragment landed in it — the generated-SQL view's context).
//   3. Still nothing → the pipeline-file top; the diagnostic message always
//      carries the statement reference so the error stays actionable.

import type { Range } from "vscode-languageserver"
import type { PositionMap } from "../mappers/source-position-mapper.js"
import type { SynthesisResult } from "../synth/types.js"

export interface ResolvedGatewayRange {
  readonly range: Range
  /** The node the range belongs to, when one resolved. */
  readonly nodeId?: string
  /** Which chain step produced the range (for tests/diagnostic data). */
  readonly via: "origin" | "contributor" | "file-top"
}

const FILE_TOP: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 1 },
}

export function resolveGatewayRange(
  statementIndex: number,
  result: SynthesisResult,
  positionMap: PositionMap,
): ResolvedGatewayRange {
  // 1. The statement's origin node (source/sink DDL ownership).
  const origin = result.statementOrigins.find(
    (o) => o.statementIndex === statementIndex,
  )
  if (origin) {
    const range = positionMap.map.get(origin.nodeId)
    if (range) return { range, nodeId: origin.nodeId, via: "origin" }
  }

  // 2. Any mapped contributor (DML has no single origin, but its fragments
  //    name every contributing node — first mapped one wins).
  const contributors = result.statementContributors.find(
    (c) => c.statementIndex === statementIndex,
  )
  for (const fragment of contributors?.fragments ?? []) {
    const range = positionMap.map.get(fragment.nodeId)
    if (range) return { range, nodeId: fragment.nodeId, via: "contributor" }
  }

  // 3. Never drop: the file top, with the statement reference in the message.
  return { range: FILE_TOP, via: "file-top" }
}
