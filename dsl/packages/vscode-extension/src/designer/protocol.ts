// The `visual-designer` custom-LSP wire contract, extension side.
//
// Same convention as `graph/protocol.ts`: the *types* re-export type-only from
// `@flink-reactor/language-server` (erased at bundle time — the server module
// never enters the extension bundle), and the method-name *strings* are tiny
// and re-declared. The prop-form schema is the one VALUE import — it comes
// from the dedicated `@flink-reactor/language-server/prop-form-schema`
// subpath, a pure-data module with zero imports, so inlining it costs only
// the data itself.

export const DESIGNER_MODEL_REQUEST = "flinkReactor/designerModel"
export const APPLY_DESIGNER_EDIT_REQUEST = "flinkReactor/applyDesignerEdit"

export type {
  ApplyDesignerEditParams,
  ApplyDesignerEditResponse,
  CanvasNode,
  DesignerEdit,
  DesignerFileKind,
  DesignerModelNode,
  DesignerModelParams,
  DesignerModelResponse,
  DesignerPropEntry,
  DesignerPropValue,
  DesignerTextEdit,
  GenerateEdit,
  PropClassification,
  ScalarPropEdit,
  StructuralEdit,
  StructuralOp,
} from "@flink-reactor/language-server"

import type { ComponentFormSchema } from "@flink-reactor/language-server/prop-form-schema"

export type {
  ComponentFormSchema,
  PropFormField,
  PropInputKind,
} from "@flink-reactor/language-server/prop-form-schema"

/** One palette group posted to the webview (host-resolved from the ts-plugin
 *  inventory so the webview imports nothing). */
export interface PaletteGroup {
  readonly kind: string
  readonly components: readonly string[]
}

/** The static designer data posted to the webview once per load: palette
 *  groups, hierarchy rules, and the generated prop-form schema — all plain
 *  JSON (the webview consumes data, never imports the DSL/plugin). */
export interface DesignerStaticData {
  readonly groups: readonly PaletteGroup[]
  /** parent component → allowed children, `"*"` = any (hierarchy rules). */
  readonly rules: Readonly<Record<string, readonly string[] | "*">>
  readonly schema: Readonly<Record<string, ComponentFormSchema>>
}
