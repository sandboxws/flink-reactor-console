// Quick-fix: swap a changelog-incompatible sink for a compatible one
// (component-refactoring, Tier-3 feature 14).
//
// An `FR-CDC-` diagnostic identifies its endpoints in `data.sourceNodeId` /
// `data.sinkNodeId`; the fix replaces the sink element with a changelog-
// capable sink, *preserving transferable props verbatim* (`schema`, `name`,
// `tap`, `parallelism` — copied as source text, so even computed values
// transplant untouched) and scaffolding sink-specific props as placeholders
// the author must fill. The offered set mirrors the worker's sink-acceptance
// rule (`JdbcSink` with `upsertMode`, `PaimonSink`, `IcebergSink` — all accept
// retract/upsert), with `JdbcSink` preferred because its scaffold is fully
// literal: `keyFields` is even pre-filled from the upstream source's primary
// key when synthesis knows it.
//
// Safety: a sink with children (explicit nesting) or spread props is not
// swapped — replacing the whole element would also rewrite its subtree.

import ts from "typescript"
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
} from "vscode-languageserver"
import {
  hasSpreadProps,
  type OffsetEdit,
  type OpeningTag,
  toTextEdits,
} from "../safety.js"
import {
  componentOf,
  diagnosticData,
  elementForNode,
  ensureDslImport,
  type FixContext,
} from "./context.js"

/** Props transplanted verbatim from the old sink onto the replacement. */
const TRANSFERABLE_PROPS: ReadonlySet<string> = new Set([
  "schema",
  "name",
  "tap",
  "parallelism",
])

/**
 * Build the swap-sink quick-fixes for an `FR-CDC-` diagnostic, one per
 * changelog-compatible replacement, `JdbcSink` (upsert) preferred.
 */
export function buildSwapSinkActions(
  diagnostic: Diagnostic,
  ctx: FixContext,
): CodeAction[] {
  const data = diagnosticData(diagnostic.data)
  const sinkId = data?.sinkNodeId ?? data?.nodeId
  const component = componentOf(ctx, sinkId)
  const el = elementForNode(ctx, sinkId)
  if (!sinkId || !component || !el) return []
  if (hasSpreadProps(el)) return []
  // Only a self-closing / childless element can be replaced wholesale.
  if (ts.isJsxOpeningElement(el) && el.parent.children.length > 0) return []

  const transferred = transferableAttrText(el, ctx.sf)
  const keyFields = upsertKeyFields(sinkId, data?.sourceNodeId, ctx)
  const span = wholeElementSpan(el, ctx.sf)

  const replacements: Array<{
    readonly component: string
    readonly scaffold: string
    readonly label: string
  }> = []
  // JdbcSink's upsert mode conditionally REQUIRES `keyFields` — offer it only
  // when a key candidate is known (the source's PK, else the sink's first
  // input column), so the swapped element synthesizes without a new finding.
  if (keyFields.length > 0) {
    const keys = keyFields.map((f) => JSON.stringify(f)).join(", ")
    replacements.push({
      component: "JdbcSink",
      scaffold: `url="" table="" upsertMode keyFields={[${keys}]}`,
      label: "JdbcSink (upsert mode)",
    })
  }
  // The catalog placeholder is a structurally valid `CatalogHandle` so the
  // pipeline stays *synthesizable* after the edit (the factory reads
  // `catalog.catalogName` eagerly); the empty name is the author's TODO.
  replacements.push(
    {
      component: "PaimonSink",
      scaffold: `catalog={{ _tag: "CatalogHandle", catalogName: "", nodeId: "" }} database="" table=""`,
      label: "PaimonSink",
    },
    {
      component: "IcebergSink",
      scaffold: `catalog={{ _tag: "CatalogHandle", catalogName: "", nodeId: "" }} database="" table=""`,
      label: "IcebergSink",
    },
  )

  const actions: CodeAction[] = []
  for (const replacement of replacements) {
    const newText =
      `<${replacement.component} ${replacement.scaffold}` + `${transferred} />`
    const edits: OffsetEdit[] = [{ start: span.start, end: span.end, newText }]
    const importEdit = ensureDslImport(ctx.sf, [replacement.component])
    if (importEdit) edits.push(importEdit)

    const action = CodeAction.create(
      `Replace ${component} with ${replacement.label}`,
      CodeActionKind.QuickFix,
    )
    action.diagnostics = [diagnostic]
    action.isPreferred = replacement === replacements[0]
    action.edit = { changes: { [ctx.uri]: toTextEdits(ctx.sf, edits) } }
    actions.push(action)
  }
  return actions
}

/** The old sink's transferable attributes, copied as verbatim source text
 *  (leading space included), so computed values transplant untouched. */
function transferableAttrText(el: OpeningTag, sf: ts.SourceFile): string {
  let out = ""
  for (const prop of el.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    if (!TRANSFERABLE_PROPS.has(name)) continue
    out += ` ${prop.getText(sf)}`
  }
  return out
}

/** The upsert key for the `keyFields` scaffold: the source's primary-key
 *  columns when declared, else the first column flowing into the sink (a
 *  best-effort placeholder the author can adjust) — empty when neither is
 *  known. */
function upsertKeyFields(
  sinkNodeId: string,
  sourceNodeId: string | undefined,
  ctx: FixContext,
): string[] {
  if (sourceNodeId) {
    const table = ctx.state.result.tableSchemas.find(
      (t) => t.nodeId === sourceNodeId,
    )
    const pk = (table?.fields ?? [])
      .filter((f) => f.primaryKey)
      .map((f) => f.name)
    if (pk.length > 0) return pk
  }
  const input = ctx.state.result.tableSchemas.find(
    (t) => t.nodeId === sinkNodeId,
  )
  const first = input?.fields[0]?.name
  return first ? [first] : []
}

function wholeElementSpan(
  el: OpeningTag,
  sf: ts.SourceFile,
): { start: number; end: number } {
  const node = ts.isJsxOpeningElement(el) ? el.parent : el
  return { start: node.getStart(sf), end: node.getEnd() }
}
