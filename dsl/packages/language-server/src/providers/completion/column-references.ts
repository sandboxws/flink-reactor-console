// Synthesis-backed column-reference completions.
//
// Inside a column-referencing expression prop (classified by `context.ts`),
// offer the columns visible *to* that expression — the owning node's inferred
// upstream schema — each labeled with its Flink SQL type. The upstream schema
// is the same `HoverFacts.getUpstreamSchema` the hover column-ref card reads, so
// completion and hover agree across transforms, joins, and windows.
//
// Insertion is quote-aware: verbatim-SQL slots (a `condition`, an `on`, a `Map`
// projection value) get a back-quoted identifier, matching the generated SQL;
// codegen-quoted slots (a `groupBy` array element, a `TopN` `orderBy` key) get
// the bare name, since the codegen back-quotes it (and `quoteIdentifier` is not
// idempotent — doubling would corrupt the SQL).

import {
  type CompletionItem,
  CompletionItemKind,
  TextEdit,
} from "vscode-languageserver"
import type { HoverFacts } from "../../hover/facts.js"
import type { ColumnRefContext } from "./context.js"

export function columnReferenceCompletions(
  facts: HoverFacts,
  nodeId: string,
  ctx: ColumnRefContext,
): CompletionItem[] {
  const columns = facts.getUpstreamSchema(nodeId)
  return columns.map((col) => {
    const newText = ctx.quote === "backtick" ? `\`${col.name}\`` : col.name
    return {
      label: col.name,
      kind: CompletionItemKind.Field,
      detail: col.type,
      // Filter against the bare name regardless of the inserted back-quotes.
      filterText: col.name,
      // Rank columns above the client's generic word completions.
      sortText: `0_${col.name}`,
      textEdit: TextEdit.replace(ctx.replace, newText),
    }
  })
}
