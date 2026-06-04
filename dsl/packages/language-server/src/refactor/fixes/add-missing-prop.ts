// Quick-fix: add the missing required/conditional connector properties an
// `FR-CONN-` diagnostic names in `data.missingProps` (component-refactoring,
// Tier-3 feature 14).
//
// A deterministic projection of the Tier-1 diagnostic: the fix inserts each
// named prop with a *typed placeholder* (from the generated prop-metadata
// table, so the placeholder shape never drifts from the DSL types) onto the
// component's opening tag. The Debezium `schemaRegistryUrl` case is the same
// builder — the connector validator already emitted it in `missingProps`; the
// title just says why. Nothing is offered for spread/computed elements or
// when the prop is already present in the current text (a stale diagnostic).

import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
} from "vscode-languageserver"
import { PROP_METADATA } from "../../providers/completion/prop-metadata.generated.js"
import {
  attrInsertionOffset,
  hasSpreadProps,
  type OffsetEdit,
  toTextEdits,
} from "../safety.js"
import {
  componentOf,
  diagnosticData,
  elementForNode,
  ensureDslImport,
  type FixContext,
} from "./context.js"

/** Placeholder text for a prop, shaped by its declared type. */
function placeholderFor(component: string, prop: string): string {
  const meta = PROP_METADATA[component]?.find((p) => p.name === prop)
  const type = meta?.type ?? "string"
  if (type === "boolean") return "" // bare attribute = true
  if (type === "number") return "={0}"
  if (type === "SchemaDefinition") return "={Schema({ fields: {} })}"
  if (type.includes("[]")) return "={[]}"
  if (type.includes("Record")) return "={{}}"
  if (type === "string" || type.includes("string")) return '=""'
  return "={{}}" // presence-satisfying placeholder the author must fill
}

/**
 * Build the add-missing-prop quick-fix for an `FR-CONN-` diagnostic, or
 * nothing when the element cannot safely take a literal attribute.
 */
export function buildAddMissingPropActions(
  diagnostic: Diagnostic,
  ctx: FixContext,
): CodeAction[] {
  const data = diagnosticData(diagnostic.data)
  const missing = data?.missingProps ?? []
  if (missing.length === 0) return []
  const component = componentOf(ctx, data?.nodeId)
  const el = elementForNode(ctx, data?.nodeId)
  if (!component || !el) return []
  if (hasSpreadProps(el)) return [] // cannot insert a literal attribute safely

  // Stale guard: skip props the current text already carries.
  const present = new Set<string>()
  for (const prop of el.attributes.properties) {
    if (prop.name) present.add(prop.name.getText(ctx.sf))
  }
  const toAdd = missing.filter((p) => !present.has(p))
  if (toAdd.length === 0) return []

  // One combined insert: same-position edits would collide in a WorkspaceEdit.
  const at = attrInsertionOffset(el)
  const inserted = toAdd
    .map((prop) => ` ${prop}${placeholderFor(component, prop)}`)
    .join("")
  const edits: OffsetEdit[] = [{ start: at, end: at, newText: inserted }]
  // The SchemaDefinition placeholder references `Schema` — import it.
  if (toAdd.some((p) => placeholderFor(component, p).includes("Schema({"))) {
    const importEdit = ensureDslImport(ctx.sf, ["Schema"])
    if (importEdit) edits.push(importEdit)
  }

  const isDebezium = toAdd.includes("schemaRegistryUrl")
  const list = toAdd.map((p) => `'${p}'`).join(", ")
  const title = isDebezium
    ? `Add 'schemaRegistryUrl' (required for Debezium formats)`
    : `Add missing prop ${list} to ${component}`

  const action = CodeAction.create(title, CodeActionKind.QuickFix)
  action.diagnostics = [diagnostic]
  action.edit = { changes: { [ctx.uri]: toTextEdits(ctx.sf, edits) } }
  return [action]
}
