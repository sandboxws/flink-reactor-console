// Scalar literal-prop codemod (visual-designer, tasks 3.2–3.4).
//
// The one write that is safe on ANY pipeline: rewrite a single `editable`
// (literal) prop's initializer in place via `ts-morph`, leaving every other
// byte of the file untouched. The attribute is located by the node's
// classified initializer `Range` (the anchor) and the edit is applied as
// `JsxAttribute.setInitializer(...)` — AST-precise, formatting- and
// comment-preserving. A `readOnly` prop is refused before anything is built;
// the only-the-target-changed assertion lives in `apply-edit.ts`
// (verify-then-commit), which also re-synthesizes.

import { Project, SyntaxKind, ts } from "ts-morph"
import type { NodeProjection } from "../synth/types.js"
import type { ScalarPropEdit } from "./model.js"
import { classifyNodeProps } from "./prop-classifier.js"

export type ScalarCodemodResult =
  | {
      readonly ok: true
      readonly newText: string
      /** Offsets of the rewritten attribute in the ORIGINAL text — the window
       *  the verify step asserts the change is confined to. */
      readonly targetSpan: { readonly start: number; readonly end: number }
    }
  | { readonly ok: false; readonly refusedReason: string }

export function applyScalarPropCodemod(
  sourceText: string,
  fileName: string,
  nodes: readonly NodeProjection[],
  edit: ScalarPropEdit,
): ScalarCodemodResult {
  // 1. Classification gate (task 3.4): only an `editable` prop is ever written.
  const classified = classifyNodeProps(sourceText, fileName, nodes)
  const entries = classified.get(edit.nodeId)
  if (!entries) {
    return {
      ok: false,
      refusedReason: `Node "${edit.nodeId}" could not be located in the source (computed or loop-derived constructs are read-only).`,
    }
  }
  const entry = entries.find((e) => e.name === edit.prop)
  if (!entry) {
    return {
      ok: false,
      refusedReason: `Node "${edit.nodeId}" has no \`${edit.prop}\` prop in the source — the designer only rewrites existing literal initializers.`,
    }
  }
  if (entry.classification !== "editable" || !entry.range) {
    return {
      ok: false,
      refusedReason: `\`${edit.prop}\` is read-only: its value is a computed expression, variable reference, or spread. Use “Edit in source”.`,
    }
  }

  // 2. Value-kind gate: the new value must have the shape the form promised.
  const printed = printValue(edit.value)
  if (!printed) {
    return {
      ok: false,
      refusedReason: `Unsupported value for \`${edit.prop}\` — the designer writes strings, numbers, booleans, and literal arrays only.`,
    }
  }

  // 3. Locate the JSX attribute by the classified initializer range and set
  //    its initializer (ts-morph preserves all surrounding trivia).
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  })
  const sf = project.createSourceFile(
    fileName.endsWith(".tsx") ? fileName : "pipeline.tsx",
    sourceText,
    { scriptKind: ts.ScriptKind.TSX },
  )
  const anchor = sf.compilerNode.getPositionOfLineAndCharacter(
    entry.range.start.line,
    entry.range.start.character,
  )
  const attr = sf
    .getDescendantAtPos(anchor)
    ?.getFirstAncestorByKind(SyntaxKind.JsxAttribute)
  const attrName = attr?.getNameNode().getText()
  if (!attr || attrName !== edit.prop) {
    return {
      ok: false,
      refusedReason: `Could not locate the \`${edit.prop}\` attribute at its classified source range — the file may have changed; refresh and retry.`,
    }
  }

  const targetSpan = { start: attr.getStart(), end: attr.getEnd() }
  attr.setInitializer(printed)
  return { ok: true, newText: sf.getFullText(), targetSpan }
}

/** Deterministic literal printing: strings as JSX string attributes, numbers/
 *  booleans/arrays in braces. Returns `undefined` for unsupported shapes. */
function printValue(value: ScalarPropEdit["value"]): string | undefined {
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    return Number.isFinite(value) ? `{${String(value)}}` : undefined
  }
  if (typeof value === "boolean") return `{${String(value)}}`
  if (Array.isArray(value)) {
    const items: string[] = []
    for (const item of value) {
      if (typeof item === "string") items.push(JSON.stringify(item))
      else if (typeof item === "number" && Number.isFinite(item)) {
        items.push(String(item))
      } else return undefined
    }
    return `{[${items.join(", ")}]}`
  }
  return undefined
}
