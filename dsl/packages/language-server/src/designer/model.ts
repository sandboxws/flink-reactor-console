// The `visual-designer` custom-LSP wire contract (Tier-3 feature 15).
//
// Two requests:
//   • `flinkReactor/designerModel` — the `dag-visualization` graph model plus,
//     per node, the editability classification of every prop (the precondition
//     for every write decision) and the document's file kind (arbitrary vs
//     designer-managed) for the edit-safety matrix.
//   • `flinkReactor/applyDesignerEdit` — the single write path: scalar
//     literal-prop edits, pragma-gated structural edits, and greenfield
//     generation, all applied server-side with `ts-morph` under a
//     verify-then-commit gate and returned as plain text edits the extension
//     applies as an undoable `WorkspaceEdit`.
//
// Like every webview-facing contract here: plain JSON only — no
// `ConstructNode`, `SynthContext`, or other DSL runtime reference leaks in.

import type { GraphModelEdge, GraphModelNode } from "../graph/model.js"
import type { SourceRange } from "../synth/types.js"

/** How a prop's *source initializer* is classified for editing. `editable`
 *  means a literal (string/number/boolean, or an array/object of literals)
 *  that can be rewritten in place; `readOnly` means a computed expression,
 *  identifier reference, call, function, or interpolated template — never
 *  written by the designer. A spread contributes no entry at all. */
export type PropClassification = "editable" | "readOnly"

/** A literal prop value as it crosses the wire. */
export type DesignerPropValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[]
  | Readonly<Record<string, unknown>>

/** One prop of one node, classified from the `.tsx` AST. */
export interface DesignerPropEntry {
  readonly name: string
  readonly classification: PropClassification
  /** The current literal value — present iff `editable`. */
  readonly value?: DesignerPropValue
  /** The literal value's shape — present iff `editable`. */
  readonly valueKind?: "string" | "number" | "boolean" | "array" | "object"
  /** Source range of the initializer (the codemod anchor) — iff `editable`. */
  readonly range?: SourceRange
}

/** Whether the document is an arbitrary hand-written pipeline or a
 *  designer-managed one (`// @flink-reactor designer` pragma present AND the
 *  static-subset contract verified). `pragma-violated` means the pragma is
 *  present but the file no longer satisfies the contract — structural edits
 *  are refused with the violation as the reason. */
export type DesignerFileKind =
  | "arbitrary"
  | "designer-managed"
  | "pragma-violated"

/** A graph node extended with its per-prop editability. */
export interface DesignerModelNode extends GraphModelNode {
  readonly props: readonly DesignerPropEntry[]
}

/** The `flinkReactor/designerModel` response envelope. */
export interface DesignerModelResponse {
  readonly uri: string
  readonly version: number
  /** `false` when synthesis failed — `error` set, `nodes`/`edges` empty. */
  readonly ok: boolean
  readonly error?: string
  readonly fileKind: DesignerFileKind
  /** Why the file is not designer-managed (pragma missing or the specific
   *  static-subset violation) — drives the disabled-affordance reason. */
  readonly fileKindReason?: string
  readonly nodes: readonly DesignerModelNode[]
  readonly edges: readonly GraphModelEdge[]
  readonly statements: readonly string[]
}

/** The `flinkReactor/designerModel` request parameters. */
export interface DesignerModelParams {
  readonly uri: string
  readonly version?: number
}

// ── Edits ───────────────────────────────────────────────────────────

/** Rewrite one `editable` literal prop's initializer in place. */
export interface ScalarPropEdit {
  readonly kind: "scalarProp"
  readonly nodeId: string
  readonly prop: string
  readonly value: string | number | boolean | readonly (string | number)[]
}

/** Structural operations — designer-managed files only. */
export type StructuralOp =
  | {
      readonly op: "addNode"
      readonly component: string
      /** Literal props for the new element (strings/numbers/booleans/arrays). */
      readonly props: Readonly<
        Record<string, string | number | boolean | readonly (string | number)[]>
      >
      /** Parent node id, or `null` for the `<Pipeline>` root container. */
      readonly parentId: string | null
      /** Child index under the parent (clamped; appended when omitted). */
      readonly index?: number
    }
  | { readonly op: "deleteNode"; readonly nodeId: string }
  | {
      readonly op: "reparentNode"
      readonly nodeId: string
      /** New parent node id, or `null` for the `<Pipeline>` root container. */
      readonly parentId: string | null
      readonly index?: number
    }
  | {
      readonly op: "addJoin"
      /** Node ids of the two upstream elements to join (each is hoisted into a
       *  module-level `const` when not already one). */
      readonly leftId: string
      readonly rightId: string
      /** SQL join condition. */
      readonly on: string
      readonly joinType?: string
    }

export interface StructuralEdit {
  readonly kind: "structural"
  readonly edit: StructuralOp
}

/** A node of the greenfield canvas description (a static tree). */
export interface CanvasNode {
  readonly component: string
  readonly props: Readonly<
    Record<string, string | number | boolean | readonly (string | number)[]>
  >
  /** Identifier props referencing module imports (e.g. `schema` →
   *  `{ identifier: "OrdersSchema", importFrom: "@/schemas/orders" }`). */
  readonly identifierProps?: Readonly<
    Record<string, { readonly identifier: string; readonly importFrom: string }>
  >
  readonly children?: readonly CanvasNode[]
}

/** Emit a fresh, fully static `.tsx` from a canvas built from scratch. */
export interface GenerateEdit {
  readonly kind: "generate"
  readonly pipelineName: string
  readonly nodes: readonly CanvasNode[]
}

export type DesignerEdit = ScalarPropEdit | StructuralEdit | GenerateEdit

/** The `flinkReactor/applyDesignerEdit` request parameters. */
export interface ApplyDesignerEditParams {
  readonly uri: string
  readonly version?: number
  readonly edit: DesignerEdit
}

/** One plain text edit (mirrors LSP `TextEdit`) — the extension turns the set
 *  into a `WorkspaceEdit` so the change is visible and undoable. */
export interface DesignerTextEdit {
  readonly range: SourceRange
  readonly newText: string
}

/** The `flinkReactor/applyDesignerEdit` response envelope. Exactly one of
 *  `edits`/`refusedReason`/`error` paths is meaningful:
 *  `ok: true` + `edits` — apply them; `ok: false` + `refusedReason` — the
 *  edit-safety matrix or verification refused (expected, render the reason);
 *  `ok: false` + `error` — an unexpected failure. */
export interface ApplyDesignerEditResponse {
  readonly uri: string
  readonly version: number
  readonly ok: boolean
  /** The whole-document text edits to apply (single full-text replace). */
  readonly edits?: readonly DesignerTextEdit[]
  /** For `generate`: the new file's content (the extension creates it). */
  readonly newFileContent?: string
  /** Human-readable refusal per the edit-safety matrix / verification. */
  readonly refusedReason?: string
  readonly error?: string
}

/** The custom LSP method names, centralized so client and server agree. */
export const DESIGNER_MODEL_REQUEST = "flinkReactor/designerModel"
export const APPLY_DESIGNER_EDIT_REQUEST = "flinkReactor/applyDesignerEdit"
