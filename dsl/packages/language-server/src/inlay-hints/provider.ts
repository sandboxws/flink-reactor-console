// Synthesis-backed `textDocument/inlayHint` (schema-inlay-hints, Tier-3
// feature 10).
//
// For each ConstructNode whose opening tag intersects the requested range,
// read its already-synthesized facts (output schema, changelog mode, effective
// parallelism — plus injected time columns on windows and the merged column
// count on joins) and compose one LSP `InlayHint` anchored at the opening-tag
// end. Each fact is an independently toggleable label part carrying its own
// Markdown tooltip, so a `5 cols` hint hover-expands to the full
// `column | TYPE` schema with no extra round-trip.
//
// Never blocks, never throws, never re-synthesizes: requests are pure reads
// over the shared per-document-version state. When synthesis is unavailable
// or trails the document version the answer is empty (the refresh after the
// next debounced synthesis re-pulls); a node missing from the position map is
// skipped while its siblings still annotate.

import {
  type InlayHint,
  InlayHintKind,
  type InlayHintLabelPart,
  type MarkupContent,
  MarkupKind,
  type Range,
} from "vscode-languageserver"
import type { InlayHintsConfig } from "../config.js"
import type { DocumentSynthState } from "../document-state.js"
import { type NodeFactsIndex, nodeFactsFor } from "./facts.js"
import {
  formatChangelogPart,
  formatJoinPart,
  formatParallelismPart,
  formatSchemaPart,
  formatWindowPart,
  type HintPart,
} from "./format.js"
import { selectNodesInRange } from "./select.js"

export interface InlayHintRequest {
  /** Shared synthesis state for the document (undefined before first synth). */
  readonly state: DocumentSynthState | undefined
  /** Current document version — hints are withheld while synthesis trails it. */
  readonly documentVersion: number
  /** The viewport range the client asked about. */
  readonly range: Range
  /** The `flinkReactor.inlayHints.*` toggles. */
  readonly config: InlayHintsConfig
}

/** Separator between a node's hint parts (label-part with no tooltip). */
const SEPARATOR = " · "

export function provideInlayHints(req: InlayHintRequest): InlayHint[] {
  if (!req.config.enabled) return []
  const facts = nodeFactsFor(req.state, req.documentVersion)
  if (!facts || !req.state) return []

  const hints: InlayHint[] = []
  for (const node of selectNodesInRange(req.state.positionMap, req.range)) {
    if (!facts.isAnnotatable(node.nodeId)) continue
    const parts = partsFor(facts, node.nodeId, req.config)
    if (parts.length === 0) continue
    hints.push({
      position: { line: node.anchor.line, character: node.anchor.character },
      label: toLabelParts(parts),
      kind: InlayHintKind.Type,
      paddingLeft: true,
    })
  }
  return hints
}

/** Compose the enabled hint parts for one node: the common facts, plus the
 *  window time-column part and the join merged-count part where they apply. */
function partsFor(
  facts: NodeFactsIndex,
  nodeId: string,
  config: InlayHintsConfig,
): HintPart[] {
  const node = facts.getNodeFacts(nodeId)
  const parts: HintPart[] = []

  const schema = formatSchemaPart(node.schema, config.schema)
  if (schema) parts.push(schema)

  if (config.windowColumns) {
    const window = formatWindowPart(facts.getWindowColumns(nodeId))
    if (window) parts.push(window)
  }

  if (config.joinColumns) {
    const joinCount = facts.getJoinColumnCount(nodeId)
    if (joinCount !== undefined) parts.push(formatJoinPart(joinCount))
  }

  if (config.changelogMode && node.changelogMode) {
    parts.push(formatChangelogPart(node.changelogMode))
  }

  if (config.parallelism && node.parallelism) {
    parts.push(formatParallelismPart(node.parallelism))
  }

  return parts
}

/** Interleave tooltip-bearing parts with bare separator parts, so each fact's
 *  tooltip stays scoped to exactly its own label span. */
function toLabelParts(parts: readonly HintPart[]): InlayHintLabelPart[] {
  const out: InlayHintLabelPart[] = []
  parts.forEach((part, i) => {
    if (i > 0) out.push({ value: SEPARATOR })
    out.push({
      value: part.label,
      ...(part.tooltip ? { tooltip: markdown(part.tooltip) } : {}),
    })
  })
  return out
}

function markdown(value: string): MarkupContent {
  return { kind: MarkupKind.Markdown, value }
}
