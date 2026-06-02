// Completion dispatcher.
//
// Classifies the cursor position and routes to one of the four strategies, then
// applies the coexistence contract and stamps the FR dedup marker:
//
//   • Coexistence — when the client declares the ts-plugin is active
//     (`tsPluginActive`, from `initializationOptions`), child-component
//     completions are SUPPRESSED (the plugin owns them in-`tsserver`); the other
//     three kinds always serve. When the ts-plugin is absent (IntelliJ, or
//     VS Code with the plugin disabled), all four kinds serve standalone.
//   • Dedup marker — every item carries an `FR`-prefixed `data` marker so a
//     client may also de-duplicate defensively.
//
// Completions derive from static metadata + the parsed TSX only (no synthesis),
// so they work regardless of synthesis state.

import type { CompletionItem, CompletionList } from "vscode-languageserver"
import { childComponentCompletions } from "./child-components.js"
import { connectorPropCompletions } from "./connector-props.js"
import { type ClassifyPosition, classifyCompletion } from "./context.js"
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
  }

  for (const item of items) {
    item.data = { source: FR_DATA_MARKER, kind: ctx.kind }
  }
  return { isIncomplete: false, items }
}
