// Quick-fix: replace a misspelled identifier with the did-you-mean candidate
// (component-refactoring, Tier-3 feature 14).
//
// Two specializations of one idea — the diagnostic's `data` already carries
// the candidate, so the fix is a token replacement, never a re-derivation:
//
//   • Column (`FR-SCHEMA-`): `data.didYouMean` + `data.referencedColumn` —
//     replace the back-quoted/bare reference (`` `usr_id` `` → `` `user_id` ``)
//     inside the literal expression prop, leaving the rest of the expression
//     intact. The token is re-located in the *current* text within the
//     diagnostic's range; a stale range that no longer holds the token offers
//     nothing (task 5.4).
//
//   • Connector property (`FR-CONN-`): the candidate prop name is the entry in
//     `data.missingProps`; the misspelling is a present attribute that is not
//     a known prop of the component and sits within edit distance — rename the
//     key (`bootstrapServer` → `bootstrapServers`) and preserve its value.

import ts from "typescript"
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
} from "vscode-languageserver"
import {
  editDistance,
  suggestionThreshold,
} from "../../diagnostics/did-you-mean.js"
import { PROP_METADATA } from "../../providers/completion/prop-metadata.generated.js"
import { offsetAt } from "../../providers/definition/binding.js"
import { findSqlColumnRefs, type OffsetEdit, toTextEdits } from "../safety.js"
import {
  componentOf,
  diagnosticData,
  elementForNode,
  type FixContext,
} from "./context.js"

/**
 * Column case: replace each reference to `data.referencedColumn` within the
 * diagnostic's span with `data.didYouMean`. Offered only when the token still
 * resolves in the current text.
 */
export function buildReplaceColumnActions(
  diagnostic: Diagnostic,
  ctx: FixContext,
): CodeAction[] {
  const data = diagnosticData(diagnostic.data)
  const candidate = data?.didYouMean
  const misspelled = data?.referencedColumn
  if (!candidate || !misspelled) return []

  const start = offsetAt(ctx.sf, diagnostic.range.start)
  const end = offsetAt(ctx.sf, diagnostic.range.end)
  if (start === undefined || end === undefined || end <= start) return []

  // Re-locate the implicated token(s) in the current text (stale guard): scan
  // the diagnostic's span with the same lexical rules the validator uses.
  const slice = ctx.sourceText.slice(start, end)
  const edits: OffsetEdit[] = []
  for (const ref of findSqlColumnRefs(slice)) {
    if (ref.name !== misspelled) continue
    edits.push({
      start: start + ref.start,
      end: start + ref.start + ref.length,
      newText: candidate,
    })
  }
  if (edits.length === 0) return []

  const action = CodeAction.create(
    `Replace \`${misspelled}\` with \`${candidate}\``,
    CodeActionKind.QuickFix,
  )
  action.diagnostics = [diagnostic]
  action.edit = { changes: { [ctx.uri]: toTextEdits(ctx.sf, edits) } }
  return [action]
}

/**
 * Connector-property case: when the prop named missing by an `FR-CONN-`
 * diagnostic has a near-miss spelling among the element's present attributes
 * (and that spelling is not itself a known prop), offer renaming the key —
 * preserving its value untouched.
 */
export function buildRenamePropActions(
  diagnostic: Diagnostic,
  ctx: FixContext,
): CodeAction[] {
  const data = diagnosticData(diagnostic.data)
  const missing = data?.missingProps ?? []
  const component = componentOf(ctx, data?.nodeId)
  const el = elementForNode(ctx, data?.nodeId)
  if (!component || !el || missing.length === 0) return []

  const known = new Set((PROP_METADATA[component] ?? []).map((p) => p.name))

  const actions: CodeAction[] = []
  for (const wanted of missing) {
    for (const prop of el.attributes.properties) {
      if (!ts.isJsxAttribute(prop)) continue
      const name = ts.isIdentifier(prop.name)
        ? prop.name.text
        : prop.name.getText(ctx.sf)
      if (name === wanted || known.has(name)) continue
      if (
        editDistance(name.toLowerCase(), wanted.toLowerCase()) >
        suggestionThreshold(wanted)
      )
        continue
      const action = CodeAction.create(
        `Rename prop '${name}' to '${wanted}'`,
        CodeActionKind.QuickFix,
      )
      action.diagnostics = [diagnostic]
      action.edit = {
        changes: {
          [ctx.uri]: toTextEdits(ctx.sf, [
            {
              start: prop.name.getStart(ctx.sf),
              end: prop.name.getEnd(),
              newText: wanted,
            },
          ]),
        },
      }
      actions.push(action)
    }
  }
  return actions
}
