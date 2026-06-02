// Resolve a validation finding's source `Range` (and any cross-node
// `relatedInformation`) from the Tier-0 `nodeId → Range` position map.
//
// Placement strategy (design "Range placement"):
//   1. The offending component's JSX element span (default).
//   2. Narrowed to a prop's value span when a prop is implicated and that prop
//      is a literal attribute present in source (expression findings; single
//      existing-but-empty connector props).
//   3. Fallback chain when the node is unmapped: text-search the `component`
//      tag → the pipeline-file top with the `nodeId` appended to the message.
// A finding is never silently dropped.

import type {
  DiagnosticRelatedInformation,
  Location,
  Range,
} from "vscode-languageserver"
import type { SourceRange, ValidationDiagnostic } from "../synth/types.js"
import type { MapperContext } from "./mapper-context.js"

/** File-top range used when a finding's node cannot be located in source. */
export const FILE_TOP_RANGE: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
}

export interface ResolvedRange {
  readonly range: Range
  /** True when every locator failed and we fell back to the file top — the
   *  mapper then appends the `nodeId` to the message so the author can still
   *  find the node. */
  readonly fellBackToFileTop: boolean
}

/**
 * Resolve the primary range for a finding, applying prop-span narrowing and
 * the documented fallback chain.
 */
export function resolveRange(
  finding: ValidationDiagnostic,
  ctx: MapperContext,
): ResolvedRange {
  const { positionMap, sourceText } = ctx
  const nodeId = finding.nodeId

  // 1 + 2: mapped element, optionally narrowed to an implicated prop.
  if (nodeId && positionMap.map.has(nodeId)) {
    const narrowed = narrowToProp(finding, nodeId, ctx)
    const range = narrowed ?? (positionMap.map.get(nodeId) as SourceRange)
    return { range: range as Range, fellBackToFileTop: false }
  }

  // 3a: text-search the component tag.
  if (finding.component) {
    const found = findTagByText(sourceText, finding.component)
    if (found) return { range: found, fellBackToFileTop: false }
  }

  // 3b: file top, message gets the nodeId appended by the caller.
  return { range: FILE_TOP_RANGE, fellBackToFileTop: true }
}

/**
 * Narrow to the value span of the prop implicated by an expression or
 * connector finding, when that prop is a literal attribute recorded in the
 * position map. Returns `undefined` to keep the full element range.
 */
function narrowToProp(
  finding: ValidationDiagnostic,
  nodeId: string,
  ctx: MapperContext,
): SourceRange | undefined {
  const props = ctx.positionMap.propRanges.get(nodeId)
  if (!props || props.size === 0) return undefined
  for (const propName of implicatedProps(finding)) {
    const range = props.get(propName)
    if (range) return range
  }
  return undefined
}

/**
 * The prop name(s) a finding points at, most-specific first.
 *  - `expression`: the prop path parsed from the validator message (`… in
 *    condition: …`, `… in select.total: …`), reduced to its base attribute.
 *  - `connector`: the missing/implicated props from `details.missingProps`
 *    (narrowed only if present in source — usually they are absent, so the
 *    diagnostic stays on the tag, which is correct for a missing prop).
 */
function implicatedProps(finding: ValidationDiagnostic): string[] {
  if (finding.category === "expression") {
    const path = parsePropPath(finding.message)
    return path ? [baseProp(path)] : []
  }
  if (finding.category === "connector") {
    return (finding.details?.missingProps ?? []).map(baseProp)
  }
  return []
}

/** Extract the prop path from an expression-finding message of the shape
 *  `… invalid SQL syntax in <propPath>: …`. */
function parsePropPath(message: string): string | undefined {
  const m = /\bin ([A-Za-z_][\w.]*):/.exec(message)
  return m?.[1]
}

/** `select.total` → `select`; a leaf prop is returned unchanged. */
function baseProp(propPath: string): string {
  const dot = propPath.indexOf(".")
  return dot === -1 ? propPath : propPath.slice(0, dot)
}

/**
 * Locate a `<Component` opening tag by text and return a range covering the
 * tag name. Best-effort fallback used only when prediction failed to map the
 * node. Matches the first occurrence.
 */
export function findTagByText(
  sourceText: string,
  component: string,
): Range | undefined {
  // `Route.Branch` → match `<Route.Branch`; escape regex metacharacters.
  const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`<(${escaped})\\b`)
  const match = re.exec(sourceText)
  if (!match) return undefined
  const tagStart = match.index + 1 // skip `<`
  return offsetRange(sourceText, tagStart, tagStart + component.length)
}

/** Convert a `[start,end)` character offset span into an LSP `Range`. */
function offsetRange(text: string, start: number, end: number): Range {
  return {
    start: offsetToPosition(text, start),
    end: offsetToPosition(text, end),
  }
}

function offsetToPosition(
  text: string,
  offset: number,
): { line: number; character: number } {
  let line = 0
  let last = 0
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++
      last = i + 1
    }
  }
  return { line, character: offset - last }
}

// ── Cross-node related information ───────────────────────────────────

/**
 * Build the `relatedInformation` entries for a cross-node finding:
 *  - `changelog`: a link to the source endpoint (`details.sourceNodeId`).
 *  - `structure`/cycle: a link per participating node (`details.relatedNodeIds`).
 * Endpoints whose range is unavailable are skipped (graceful degradation, task
 * 6.3) rather than dropping the whole diagnostic.
 */
export function buildRelatedInformation(
  finding: ValidationDiagnostic,
  ctx: MapperContext,
): DiagnosticRelatedInformation[] | undefined {
  const details = finding.details
  if (!details) return undefined

  const entries: DiagnosticRelatedInformation[] = []
  const primaryId = details.sinkNodeId ?? finding.nodeId
  const seen = new Set<string>(primaryId ? [primaryId] : [])

  const add = (id: string | undefined, message: string): void => {
    if (!id || seen.has(id)) return
    const range = ctx.positionMap.map.get(id)
    if (!range) return // endpoint range unavailable → degrade
    seen.add(id)
    entries.push({
      location: { uri: ctx.uri, range: range as Range } satisfies Location,
      message,
    })
  }

  if (finding.category === "changelog") {
    add(details.sourceNodeId, "source endpoint of the changelog mismatch")
  }
  for (const id of details.relatedNodeIds ?? []) {
    add(id, "participates in the cycle")
  }

  return entries.length > 0 ? entries : undefined
}
