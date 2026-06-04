// The `textDocument/codeAction` dispatcher (component-refactoring, Tier-3
// feature 14).
//
// Routes the in-range `FR-*` diagnostics (delivered by the client in
// `context.diagnostics`) to the per-fix builders by code prefix — each fix is
// a deterministic projection of the diagnostic's `data` — and offers the
// extract-inline-schema refactor for cursor positions over an inline
// `Schema({...})`. Every action carries exactly one `WorkspaceEdit`; when no
// safe edit exists the builders return nothing and the dispatcher returns an
// empty list (never a partial or speculative edit).
//
// Diagnostic-driven fixes require the held synthesis state to match the live
// document version — a stale source map could point an edit at moved text, so
// staleness degrades to "no quick-fixes" (extract-schema, being pure AST,
// still works).

import type { CodeAction, Diagnostic, Range } from "vscode-languageserver"
import { DIAGNOSTIC_SOURCE } from "../diagnostics/codes.js"
import type { DocumentSynthState } from "../document-state.js"
import { parseSource } from "../providers/definition/binding.js"
import { buildExtractSchemaActions } from "./extract-schema.js"
import { buildAddMissingPropActions } from "./fixes/add-missing-prop.js"
import type { FixContext } from "./fixes/context.js"
import {
  buildRenamePropActions,
  buildReplaceColumnActions,
} from "./fixes/replace-candidate.js"
import { buildSwapSinkActions } from "./fixes/swap-sink.js"
import { buildWrapWindowActions } from "./fixes/wrap-window.js"
import { uriToFilePath } from "./schema-decl.js"

export interface CodeActionInput {
  readonly state: DocumentSynthState | undefined
  readonly sourceText: string
  readonly uri: string
  readonly range: Range
  /** The client-provided diagnostics overlapping `range`. */
  readonly diagnostics: readonly Diagnostic[]
  readonly documentVersion: number
}

/** Compute the code actions for a request — quick-fixes keyed to the `FR-*`
 *  diagnostics in range plus the extract-schema refactor. Never throws. */
export function provideCodeActions(input: CodeActionInput): CodeAction[] {
  try {
    return computeActions(input)
  } catch {
    return [] // a refactoring must never take the server down
  }
}

function computeActions(input: CodeActionInput): CodeAction[] {
  const actions: CodeAction[] = []
  const filePath = uriToFilePath(input.uri)
  if (!filePath) return actions

  const fresh =
    input.state !== undefined && input.state.version === input.documentVersion

  if (fresh && input.state) {
    const ctx: FixContext = {
      state: input.state,
      sf: parseSource(input.sourceText, filePath),
      sourceText: input.sourceText,
      uri: input.uri,
    }
    for (const diagnostic of input.diagnostics) {
      if (diagnostic.source !== DIAGNOSTIC_SOURCE) continue
      const code = typeof diagnostic.code === "string" ? diagnostic.code : ""
      if (code.startsWith("FR-CONN-")) {
        actions.push(...buildAddMissingPropActions(diagnostic, ctx))
        actions.push(...buildRenamePropActions(diagnostic, ctx))
      } else if (code.startsWith("FR-SCHEMA-")) {
        actions.push(...buildReplaceColumnActions(diagnostic, ctx))
      } else if (code.startsWith("FR-CDC-")) {
        actions.push(...buildWrapWindowActions(diagnostic, ctx))
        actions.push(...buildSwapSinkActions(diagnostic, ctx))
      }
    }
  }

  // Refactors are cursor-anchored, not diagnostic-anchored.
  actions.push(
    ...buildExtractSchemaActions({
      sourceText: input.sourceText,
      uri: input.uri,
      position: input.range.start,
    }),
  )

  return actions
}
