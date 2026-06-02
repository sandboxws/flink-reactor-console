// Connector-property completions.
//
// Offers a component's valid props from the build-time prop-metadata projection
// (`prop-metadata.generated.ts`, derived from the DSL's typed interfaces), with
// required props ranked first and props already present on the element excluded.
// Item detail/documentation come from the prop's type and JSDoc.

import {
  type CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver"
import { PROP_METADATA } from "./prop-metadata.generated.js"
import { propAttributeSnippet } from "./snippet-builder.js"

export function connectorPropCompletions(
  component: string,
  presentProps: readonly string[],
): CompletionItem[] {
  const props = PROP_METADATA[component]
  if (!props) return [] // unknown/non-connector component → no FR items
  const present = new Set(presentProps)

  return props
    .filter((p) => !present.has(p.name))
    .map((p) => ({
      label: p.name,
      kind: CompletionItemKind.Field,
      detail: p.required ? `(required) ${p.type}` : p.type,
      documentation: p.doc
        ? { kind: MarkupKind.Markdown, value: p.doc }
        : undefined,
      insertText: propAttributeSnippet(p),
      insertTextFormat: InsertTextFormat.Snippet,
      // Required props sort first; alphabetical within each group.
      sortText: `${p.required ? "0" : "1"}_${p.name}`,
    }))
}
