// Flink SQL type completions.
//
// In a schema/column type-string position (a value among the `fields` of a
// `Schema({ ... })` call), offers the valid Flink SQL type strings. Parameterized
// and composite forms (`DECIMAL(p,s)`, `TIMESTAMP(n)`, `ARRAY<T>`, …) insert with
// placeholder tab stops the author then fills.

import {
  type CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
} from "vscode-languageserver"
import { FLINK_TYPE_COMPLETIONS } from "./snippet-builder.js"

export function flinkTypeCompletions(): CompletionItem[] {
  return FLINK_TYPE_COMPLETIONS.map((t, i) => ({
    label: t.label,
    kind: CompletionItemKind.TypeParameter,
    detail: t.detail,
    insertText: t.insertText,
    insertTextFormat: t.isSnippet
      ? InsertTextFormat.Snippet
      : InsertTextFormat.PlainText,
    // Stable order: primitives, then parameterized, then composite.
    sortText: String(i).padStart(3, "0"),
  }))
}
