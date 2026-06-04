// `flinkReactor/applyDesignerEdit` orchestration (visual-designer):
// the single write path for scalar, structural, and greenfield edits, with
// the edit-safety matrix as the first gate and VERIFY-THEN-COMMIT as the
// last:
//
//   1. Decide safety from the matrix (edit kind × file kind) — an unsafe edit
//      is refused with its reason before any codemod is built (tasks 8.1/8.2).
//   2. Apply the codemod in memory (`ts-morph`); the file on disk / in the
//      editor is untouched.
//   3. Verify: re-parse (no syntax errors), assert the change is confined to
//      the targeted span for scalar edits (other props byte-identical), and
//      re-synthesize the edited text — a failed synthesis means the edit
//      would break the pipeline, so it is ROLLED BACK by simply not
//      returning it (tasks 3.3, 4.5, 8.5). The user's file is never left
//      half-edited because nothing was written yet.
//   4. Commit: return the change as plain text edits the extension applies as
//      one undoable `WorkspaceEdit` (task 3.5) — or as `newFileContent` for
//      greenfield generation.

import ts from "typescript"
import type { SynthesisResult } from "../synth/types.js"
import { decideEditSafety, type SafetyEditKind } from "./edit-safety.js"
import { generatePipelineFile } from "./greenfield.js"
import type {
  ApplyDesignerEditParams,
  ApplyDesignerEditResponse,
  DesignerTextEdit,
} from "./model.js"
import { classifyNodeProps } from "./prop-classifier.js"
import { applyScalarPropCodemod } from "./scalar-codemod.js"
import { resolveFileKind } from "./static-subset.js"
import { applyStructuralCodemod } from "./structural-codemod.js"

export interface ApplyEditContext {
  /** The current document text (the source of truth being edited). */
  readonly sourceText: string
  readonly fileName: string
  /** Node projections from the held synthesis (element pairing). */
  readonly nodes: readonly NodeLike[]
  /** Re-synthesize arbitrary text for verification (never mutates the store). */
  readonly synthesize: (text: string) => Promise<SynthesisResult>
}

type NodeLike = SynthesisResult["nodes"][number]

export async function applyDesignerEdit(
  params: ApplyDesignerEditParams,
  context: ApplyEditContext,
): Promise<ApplyDesignerEditResponse> {
  const version = params.version ?? 0
  const respond = (
    partial: Partial<ApplyDesignerEditResponse> & { ok: boolean },
  ): ApplyDesignerEditResponse => ({ uri: params.uri, version, ...partial })

  try {
    const edit = params.edit

    // ── Greenfield: a NEW file — clobbers nothing, no verification target.
    if (edit.kind === "generate") {
      const content = generatePipelineFile(edit)
      const synth = await context.synthesize(content)
      if (!synth.ok) {
        return respond({
          ok: false,
          error: `Generated pipeline does not synthesize: ${synth.loadError?.message ?? "unknown error"}`,
        })
      }
      return respond({ ok: true, newFileContent: content })
    }

    // ── Edit-safety matrix gate (the single decision point) ──────────
    const { fileKind, fileKindReason } = resolveFileKind(
      context.sourceText,
      context.fileName,
    )
    const safetyKind: SafetyEditKind =
      edit.kind === "scalarProp"
        ? {
            kind: "scalarProp",
            classification: classificationOf(context, edit.nodeId, edit.prop),
          }
        : { kind: "structural" }
    const decision = decideEditSafety(safetyKind, fileKind, fileKindReason)
    if (!decision.safe) {
      return respond({ ok: false, refusedReason: decision.reason })
    }

    // ── Codemod (in memory) ───────────────────────────────────────────
    let newText: string
    let targetSpan: { start: number; end: number } | undefined
    if (edit.kind === "scalarProp") {
      const result = applyScalarPropCodemod(
        context.sourceText,
        context.fileName,
        context.nodes,
        edit,
      )
      if (!result.ok) {
        return respond({ ok: false, refusedReason: result.refusedReason })
      }
      newText = result.newText
      targetSpan = result.targetSpan
    } else {
      const result = applyStructuralCodemod(
        context.sourceText,
        context.fileName,
        context.nodes,
        edit.edit,
      )
      if (!result.ok) {
        return respond({ ok: false, refusedReason: result.refusedReason })
      }
      newText = result.newText
    }

    // ── Verify-then-commit ────────────────────────────────────────────
    // (a) Re-parse: the edited text must be syntactically sound.
    const parseError = firstParseError(newText, context.fileName)
    if (parseError) {
      return respond({
        ok: false,
        refusedReason: `Edit rolled back: the rewritten file does not parse (${parseError}).`,
      })
    }
    // (b) Scalar edits: assert ONLY the targeted initializer changed — every
    //     byte outside the original attribute span must be identical.
    if (targetSpan) {
      const window = changedWindow(context.sourceText, newText)
      if (
        window &&
        (window.start < targetSpan.start || window.endOld > targetSpan.end)
      ) {
        return respond({
          ok: false,
          refusedReason:
            "Edit rolled back: the codemod touched more than the targeted prop initializer.",
        })
      }
    }
    // (c) Re-synthesize the edited text: a value that breaks synthesis is
    //     rolled back rather than committed.
    const synth = await context.synthesize(newText)
    if (!synth.ok) {
      return respond({
        ok: false,
        refusedReason: `Edit rolled back: the edited pipeline no longer synthesizes (${synth.loadError?.message ?? "unknown error"}).`,
      })
    }

    return respond({
      ok: true,
      edits: [minimalEdit(context.sourceText, newText)],
    })
  } catch (err) {
    return respond({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

function classificationOf(
  context: ApplyEditContext,
  nodeId: string,
  prop: string,
): "editable" | "readOnly" {
  const classified = classifyNodeProps(
    context.sourceText,
    context.fileName,
    context.nodes,
  )
  const entry = classified.get(nodeId)?.find((e) => e.name === prop)
  return entry?.classification === "editable" ? "editable" : "readOnly"
}

// ── Verification helpers ────────────────────────────────────────────

interface ParseDiagnosticsCarrier {
  readonly parseDiagnostics: readonly ts.Diagnostic[]
}

function firstParseError(text: string, fileName: string): string | undefined {
  const sf = ts.createSourceFile(
    fileName.endsWith(".tsx") ? fileName : "pipeline.tsx",
    text,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  )
  const diags = (sf as unknown as ParseDiagnosticsCarrier).parseDiagnostics
  const first = diags?.[0]
  if (!first) return undefined
  return ts.flattenDiagnosticMessageText(first.messageText, " ")
}

/** The contiguous window [start, endOld) of `oldText` that differs from
 *  `newText`, or `undefined` when they are identical. */
function changedWindow(
  oldText: string,
  newText: string,
): { start: number; endOld: number } | undefined {
  if (oldText === newText) return undefined
  let start = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (start < minLen && oldText[start] === newText[start]) start++
  let endOld = oldText.length
  let endNew = newText.length
  while (
    endOld > start &&
    endNew > start &&
    oldText[endOld - 1] === newText[endNew - 1]
  ) {
    endOld--
    endNew--
  }
  return { start, endOld }
}

/** One minimal text edit turning `oldText` into `newText` (LSP-range form). */
function minimalEdit(oldText: string, newText: string): DesignerTextEdit {
  const window = changedWindow(oldText, newText)
  if (!window) {
    return {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      newText: "",
    }
  }
  const endNew = newText.length - (oldText.length - window.endOld)
  return {
    range: {
      start: offsetToPosition(oldText, window.start),
      end: offsetToPosition(oldText, window.endOld),
    },
    newText: newText.slice(window.start, endNew),
  }
}

function offsetToPosition(
  text: string,
  offset: number,
): { line: number; character: number } {
  let line = 0
  let lineStart = 0
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\n") {
      line++
      lineStart = i + 1
    }
  }
  return { line, character: offset - lineStart }
}
