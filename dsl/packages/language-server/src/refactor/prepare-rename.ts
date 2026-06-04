// The `textDocument/prepareRename` gate + `textDocument/rename` router
// (component-refactoring, Tier-3 feature 14).
//
// `prepareRename` validates the token under the cursor *before* the client
// prompts for a new name: it accepts (a) a field key inside a `Schema({...})`
// literal, (b) a back-quoted/bare column reference that resolves to a schema
// field, or (c) a node/pipeline `name` value — returning the token's precise
// range — and rejects everything else (SQL keywords, literals, function
// names, non-FR identifiers) by returning `null`, so the user never starts a
// rename that would do nothing.
//
// `rename` routes the same classification to the column or name rename and
// returns the `WorkspaceEdit`, or `null` when no safe edit exists. Both
// operations require the held synthesis state to match the document version —
// a write derived from a stale snapshot could land on moved text, so
// staleness is refusal (the documented trade-off), with the column *field-key*
// case exempt for `prepareRename` only (it is pure AST classification).

import type { Range, WorkspaceEdit } from "vscode-languageserver"
import { nameRenameTargetAt, renameNodeName } from "./name-rename.js"
import {
  columnRenameTargetAt,
  type RefactorInput,
  renameSchemaColumn,
} from "./schema-rename.js"

export interface RenameInput extends RefactorInput {
  /** The live document version, compared against the held synthesis state. */
  readonly documentVersion: number
}

/** True when the held state is current for the document. Rename is a write —
 *  a stale source map must refuse rather than edit drifted spans. */
function fresh(input: RenameInput): boolean {
  return (
    input.state !== undefined && input.state.version === input.documentVersion
  )
}

/**
 * Validate the rename target under the cursor. Returns the precise range of
 * the renamable token, or `null` to reject the rename.
 */
export function prepareRenameAt(input: RenameInput): Range | null {
  if (!fresh(input)) return null
  const column = columnRenameTargetAt(input)
  if (column) return column.range
  const name = nameRenameTargetAt(input)
  if (name) return name.range
  return null
}

/**
 * Compute the rename `WorkspaceEdit` for the validated target, or `null` when
 * the position is not renamable or no safe edit exists.
 */
export function renameAt(
  input: RenameInput,
  newName: string,
): WorkspaceEdit | null {
  if (!fresh(input)) return null
  const column = columnRenameTargetAt(input)
  if (column) return renameSchemaColumn(input, column, newName)
  const name = nameRenameTargetAt(input)
  if (name) return renameNodeName(input, name, newName)
  return null
}
