// Completion dispatcher.
//
// Classifies the cursor position and routes to a strategy, then applies the
// coexistence contract and stamps the FR dedup marker:
//
//   • Coexistence — when the client declares the ts-plugin is active
//     (`tsPluginActive`, from `initializationOptions`), child-component
//     completions are SUPPRESSED (the plugin owns them in-`tsserver`); the other
//     kinds always serve. When the ts-plugin is absent (IntelliJ, or VS Code
//     with the plugin disabled), all kinds serve standalone.
//   • Dedup marker — every item carries an `FR`-prefixed `data` marker so a
//     client may also de-duplicate defensively.
//
// The child/connector/enum/type strategies derive from static metadata + the
// parsed TSX only (no synthesis). The `column-ref` strategy is the exception: it
// reads the shared per-document synthesis state to resolve the owning node's
// upstream schema, degrading to no items (never erroring) when synthesis is
// absent or the node/schema cannot be resolved.

import type { CompletionItem, CompletionList } from "vscode-languageserver"
import type { DocumentSynthState } from "../../document-state.js"
import { HoverFacts } from "../../hover/facts.js"
import { resolveNodeAt } from "../../hover/resolve.js"
import { childComponentCompletions } from "./child-components.js"
import { columnReferenceCompletions } from "./column-references.js"
import { connectorPropCompletions } from "./connector-props.js"
import {
  type ClassifyPosition,
  type ColumnRefContext,
  classifyCompletion,
} from "./context.js"
import { enumValueCompletions } from "./enum-values.js"
import { flinkTypeCompletions } from "./flink-types.js"

/** Prefix marking every FR-served completion item for defensive client dedup. */
export const FR_DATA_MARKER = "FR"

export interface CompletionRequest {
  readonly sourceText: string
  readonly fileName: string
  readonly position: ClassifyPosition
  /** Set by the client when the ts-plugin owns child completions in-tsserver. */
  readonly tsPluginActive: boolean
  /** Latest synthesis state for the document, for synthesis-backed column
   *  completion. Absent before the first synth (column completion then yields
   *  no items, leaving the other strategies untouched). */
  readonly synthState?: DocumentSynthState
}

const EMPTY: CompletionList = { isIncomplete: false, items: [] }

export function provideCompletion(req: CompletionRequest): CompletionList {
  const ctx = classifyCompletion(req.sourceText, req.fileName, req.position)
  if (!ctx) return EMPTY

  let items: CompletionItem[]
  switch (ctx.kind) {
    case "child-component":
      // Suppressed when the ts-plugin owns child completions in-tsserver.
      items = req.tsPluginActive ? [] : childComponentCompletions(ctx.parent)
      break
    case "connector-prop":
      items = connectorPropCompletions(ctx.component, ctx.presentProps)
      break
    case "enum-value":
      items = enumValueCompletions(ctx.component, ctx.prop)
      break
    case "flink-type":
      items = flinkTypeCompletions()
      break
    case "column-ref":
      items = columnRefItems(ctx, req)
      break
  }

  for (const item of items) {
    item.data = { source: FR_DATA_MARKER, kind: ctx.kind }
  }
  return { isIncomplete: false, items }
}

/**
 * Resolve the owning node's upstream schema and build column items. Total: any
 * unmet precondition (no synth yet, a load/synth error, an unmappable cursor)
 * yields no items rather than erroring. The latest synthesis result is used even
 * when it lags the current edit — completion fires mid-edit, and a slightly
 * stale schema beats none; an unresolvable cursor simply yields nothing.
 */
function columnRefItems(
  ctx: ColumnRefContext,
  req: CompletionRequest,
): CompletionItem[] {
  const state = req.synthState
  if (!state) return []
  const facts = new HoverFacts(state.result)
  if (!facts.ok) return []
  const resolved = resolveNodeAt(state.positionMap, req.position)
  if (!resolved) return []
  return columnReferenceCompletions(facts, resolved.nodeId, ctx)
}
