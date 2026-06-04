// Quick-fix: wrap a window-less `<Aggregate>` in a window (component-
// refactoring, Tier-3 feature 14).
//
// A non-windowed aggregation over an unbounded stream emits a retract
// changelog, which is what the `FR-CDC-` diagnostic on the downstream sink is
// reporting. The fix addresses the *root cause*: locate the unbounded
// Aggregate on the diagnostic's source→sink path — authoritatively, by its
// decoded changelog mode (`retract` iff unwindowed; a windowed aggregate is
// `append-only`) — and wrap its element in a `<TumbleWindow>` with a
// placeholder size, preserving the aggregate's props, grouping, and children.
// `SlideWindow`/`SessionWindow` are offered as alternates (code actions are
// non-interactive, so the choice is a set of actions, Tumble first).
//
// The window's `on` time-column placeholder prefers the upstream source's
// watermark column (the only column a window can legally use), falling back
// to a TIMESTAMP-typed input column, then a generic placeholder.

import ts from "typescript"
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
} from "vscode-languageserver"
import type { DecodedEdge } from "../../synth/types.js"
import { type OffsetEdit, type OpeningTag, toTextEdits } from "../safety.js"
import {
  diagnosticData,
  elementForNode,
  ensureDslImport,
  type FixContext,
} from "./context.js"

interface WindowKind {
  readonly component: "TumbleWindow" | "SlideWindow" | "SessionWindow"
  readonly attrs: string
}

const WINDOW_KINDS: readonly WindowKind[] = [
  { component: "TumbleWindow", attrs: 'size="1 minute"' },
  { component: "SlideWindow", attrs: 'size="1 minute" slide="30 seconds"' },
  { component: "SessionWindow", attrs: 'gap="5 minutes"' },
]

/**
 * Build the wrap-in-window quick-fixes for an `FR-CDC-` diagnostic whose
 * source→sink path contains an unbounded `Aggregate`, or nothing when the
 * retract mode has a different origin (then only the sink-swap fix applies).
 */
export function buildWrapWindowActions(
  diagnostic: Diagnostic,
  ctx: FixContext,
): CodeAction[] {
  const data = diagnosticData(diagnostic.data)
  const sinkId = data?.sinkNodeId ?? data?.nodeId
  if (!sinkId) return []

  const aggregateId = unboundedAggregateUpstreamOf(sinkId, ctx)
  if (!aggregateId) return []
  const opening = elementForNode(ctx, aggregateId)
  if (!opening) return []

  const span = wholeElementSpan(opening, ctx.sf)
  const elementText = ctx.sourceText.slice(span.start, span.end)
  const indent = lineIndentAt(ctx.sourceText, span.start)
  const timeColumn = windowTimeColumn(aggregateId, data?.sourceNodeId, ctx)

  const actions: CodeAction[] = []
  for (const kind of WINDOW_KINDS) {
    const wrapped =
      `<${kind.component} ${kind.attrs} on="${timeColumn}">\n` +
      `${indent}  ${reindent(elementText, indent)}\n` +
      `${indent}</${kind.component}>`
    const edits: OffsetEdit[] = [
      { start: span.start, end: span.end, newText: wrapped },
    ]
    const importEdit = ensureDslImport(ctx.sf, [kind.component])
    if (importEdit) edits.push(importEdit)

    const action = CodeAction.create(
      `Wrap Aggregate in <${kind.component}>`,
      CodeActionKind.QuickFix,
    )
    action.diagnostics = [diagnostic]
    action.isPreferred = kind.component === "TumbleWindow"
    action.edit = { changes: { [ctx.uri]: toTextEdits(ctx.sf, edits) } }
    actions.push(action)
  }
  return actions
}

/** The id of an `Aggregate` upstream of `sinkId` whose decoded changelog mode
 *  is `retract` — i.e. an unbounded (window-less) aggregation. */
function unboundedAggregateUpstreamOf(
  sinkId: string,
  ctx: FixContext,
): string | undefined {
  const modeOf = new Map(
    ctx.state.result.changelogModes.map((m) => [m.nodeId, m.mode]),
  )
  const componentOf = new Map(
    ctx.state.result.nodes.map((n) => [n.id, n.component]),
  )
  const incoming = incomingIndex(ctx.state.result.dagEdges)
  const seen = new Set<string>()
  let frontier = incoming.get(sinkId) ?? []
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      if (componentOf.get(id) === "Aggregate" && modeOf.get(id) === "retract") {
        return id
      }
      next.push(...(incoming.get(id) ?? []))
    }
    frontier = next
  }
  return undefined
}

/** Pick the `on` placeholder: the source's watermark column, else a
 *  TIMESTAMP-typed column visible to the aggregate, else a generic name. */
function windowTimeColumn(
  aggregateId: string,
  sourceNodeId: string | undefined,
  ctx: FixContext,
): string {
  if (sourceNodeId) {
    const table = ctx.state.result.tableSchemas.find(
      (t) => t.nodeId === sourceNodeId,
    )
    if (table?.watermark) return table.watermark.column
  }
  const input = ctx.state.result.nodeInputSchemas.find(
    (s) => s.nodeId === aggregateId,
  )
  const timestamp = input?.columns.find((c) =>
    c.type.toUpperCase().startsWith("TIMESTAMP"),
  )
  return timestamp?.name ?? "event_time"
}

function incomingIndex(edges: readonly DecodedEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.to)
    if (list) list.push(e.from)
    else incoming.set(e.to, [e.from])
  }
  return incoming
}

/** The span of the whole element: the enclosing `JsxElement` when the opening
 *  tag has a closing counterpart, else the self-closing tag itself. */
function wholeElementSpan(
  opening: OpeningTag,
  sf: ts.SourceFile,
): { start: number; end: number } {
  const node = ts.isJsxOpeningElement(opening) ? opening.parent : opening
  return { start: node.getStart(sf), end: node.getEnd() }
}

/** Leading whitespace of the line `offset` sits on. */
function lineIndentAt(text: string, offset: number): string {
  let lineStart = offset
  while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--
  let i = lineStart
  while (i < text.length && (text[i] === " " || text[i] === "\t")) i++
  return text.slice(lineStart, i)
}

/** Re-indent a multi-line element body one level deeper under the wrapper. */
function reindent(elementText: string, baseIndent: string): string {
  return elementText
    .split("\n")
    .map((line, i) => {
      if (i === 0) return line
      return line.startsWith(baseIndent) ? `  ${line}` : line
    })
    .join("\n")
}
