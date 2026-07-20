// Enum-value completions.
//
// For a prop whose type is a string-literal union (resolved through any alias by
// the build-time projection — `KafkaStartupMode`, `KafkaFormat`/`SinkFormat`,
// the Iceberg/Paimon enums, …), offers exactly the union's literal values. The
// cursor sits inside the attribute's quotes, so insert text is the bare literal.

import { type CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { PROP_METADATA } from "./prop-metadata.generated.js"

export function enumValueCompletions(
  component: string,
  prop: string,
): CompletionItem[] {
  const meta = PROP_METADATA[component]?.find((p) => p.name === prop)
  if (!meta?.enumValues) return [] // not a string-literal-union prop → no items

  return meta.enumValues.map((value, i) => ({
    label: value,
    kind: CompletionItemKind.EnumMember,
    detail: `${component}.${prop}`,
    insertText: value,
    // Preserve the union's declared order.
    sortText: String(i).padStart(3, "0"),
  }))
}
