// Child-component completions.
//
// Offers only the components valid as children of the enclosing parent, read
// from the SAME `@flink-reactor/ts-plugin` hierarchy rules the plugin uses in
// `tsserver` — so component validity never drifts between the two. Dot-notation
// sub-components (`Route.Branch`, `Query.Select`, …) appear only inside their
// correct parent because they only exist in that parent's allowed-children
// list. Insertions are snippets that pre-fill required props as tab stops.
//
// This strategy is suppressed by the dispatcher when the ts-plugin is active
// (it owns child completions in-`tsserver`); see `index.ts`.

import {
  createRulesRegistry,
  DSL_COMPONENTS,
  getTopLevelComponents,
} from "@flink-reactor/ts-plugin/rules"
import {
  type CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
} from "vscode-languageserver"
import { childElementSnippet } from "./snippet-builder.js"

const registry = createRulesRegistry()

/** A component is a container when the rules give it any allowed children. */
function isContainer(name: string): boolean {
  const allowed = registry.getAllowedChildren(name)
  return allowed === "*" || (Array.isArray(allowed) && allowed.length > 0)
}

export function childComponentCompletions(parent: string): CompletionItem[] {
  const allowed = registry.getAllowedChildren(parent)
  if (allowed === undefined) return [] // unknown parent → defer (no FR items)
  // A wildcard parent (e.g. `Route.Branch`) accepts any top-level component.
  const children = allowed === "*" ? getTopLevelComponents() : allowed

  return children.map((name) => ({
    label: name,
    kind: CompletionItemKind.Class,
    detail: DSL_COMPONENTS.get(name) ?? "Component",
    insertText: childElementSnippet(name, isContainer(name)),
    insertTextFormat: InsertTextFormat.Snippet,
    // Keep curated children ranked above generic editor suggestions.
    sortText: `0_${name}`,
  }))
}
