// Re-synthesis parity helpers (component-refactoring, Tier-3 feature 14).
//
// The correctness gate for every rename/fix: apply the `WorkspaceEdit` to the
// document text(s), re-synthesize, and assert the originating finding is gone
// with no *new* finding introduced (design: "a parity check gates
// correctness; never fall back to lexical replace"). The application logic
// lives here — pure text manipulation, no LSP client — so the test fixtures
// exercise exactly the edits the server would hand the editor.

import type { TextEdit, WorkspaceEdit } from "vscode-languageserver"
import type { SynthesisResult, ValidationDiagnostic } from "../synth/types.js"

/** Apply LSP `TextEdit`s to a text buffer (offsets computed against the
 *  buffer's own line map; edits applied last-to-first so spans stay valid). */
export function applyTextEdits(
  text: string,
  edits: readonly TextEdit[],
): string {
  const lineStarts = computeLineStarts(text)
  const at = (p: { line: number; character: number }): number =>
    (lineStarts[p.line] ?? text.length) + p.character
  const resolved = edits
    .map((e) => ({
      start: at(e.range.start),
      end: at(e.range.end),
      newText: e.newText,
    }))
    .sort((a, b) => b.start - a.start || b.end - a.end)
  let out = text
  for (const e of resolved) {
    out = out.slice(0, e.start) + e.newText + out.slice(e.end)
  }
  return out
}

/**
 * Apply a `WorkspaceEdit` to a set of in-memory documents keyed by URI.
 * Handles both the `changes` shape (renames/fixes) and `documentChanges` with
 * `CreateFile` + `TextDocumentEdit` (the extract-schema refactor): a created
 * file starts empty and receives its inserts. Unknown URIs in `changes` throw
 * — an edit targeting a document the test did not stage is a bug.
 */
export function applyWorkspaceEdit(
  documents: Readonly<Record<string, string>>,
  edit: WorkspaceEdit,
): Record<string, string> {
  const out: Record<string, string> = { ...documents }

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const text = out[uri]
      if (text === undefined) {
        throw new Error(`WorkspaceEdit targets unstaged document: ${uri}`)
      }
      out[uri] = applyTextEdits(text, edits)
    }
  }

  for (const change of edit.documentChanges ?? []) {
    if ("kind" in change) {
      if (change.kind === "create") out[change.uri] = out[change.uri] ?? ""
      continue // rename/delete are not produced by this capability
    }
    const uri = change.textDocument.uri
    const text = out[uri]
    if (text === undefined) {
      throw new Error(`WorkspaceEdit targets unstaged document: ${uri}`)
    }
    out[uri] = applyTextEdits(text, change.edits)
  }

  return out
}

/**
 * Findings present after an edit that were not present before, optionally
 * filtered by category (`"schema"` for the rename parity check). Identity is
 * the (category, message) pair — a rename that misses a reference produces a
 * fresh unknown-column message, which is exactly what this surfaces.
 */
export function newFindings(
  before: SynthesisResult,
  after: SynthesisResult,
  category?: string,
): ValidationDiagnostic[] {
  const seen = new Set(
    before.diagnostics.map((d) => `${d.category}:${d.message}`),
  )
  return after.diagnostics.filter(
    (d) =>
      (category === undefined || d.category === category) &&
      !seen.has(`${d.category}:${d.message}`),
  )
}

function computeLineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1)
  }
  return starts
}
