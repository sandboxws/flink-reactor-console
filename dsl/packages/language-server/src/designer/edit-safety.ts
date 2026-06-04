// The edit-safety matrix (visual-designer, task 8.1) — the SINGLE decision
// point over (edit kind) × (file kind). Every write path consults this table
// and nothing else; every refusal carries a human-readable reason. The
// designer never performs a write this classifies as unsafe — it degrades
// (read-only field + "Edit in source", disabled affordance with the reason)
// instead of corrupting code.
//
// | Edit kind                          | Arbitrary `.tsx`     | Designer-managed `.tsx` |
// |------------------------------------|----------------------|-------------------------|
// | Open / read-only view              | SAFE                 | SAFE                    |
// | Scalar edit, prop `editable`       | SAFE                 | SAFE                    |
// | Scalar edit, prop `readOnly`       | REFUSED              | REFUSED                 |
// | Add / delete / re-parent / add-join| REFUSED              | SAFE                    |
// | Free wiring                        | REFUSED              | SAFE (hierarchy rules)  |
// | Regenerate whole file from canvas  | REFUSED              | n/a (greenfield = NEW)  |

import type { DesignerFileKind, PropClassification } from "./model.js"

export type SafetyEditKind =
  | { readonly kind: "view" }
  | { readonly kind: "scalarProp"; readonly classification: PropClassification }
  | { readonly kind: "structural" }
  | { readonly kind: "freeWiring" }
  | { readonly kind: "regenerateFile" }
  | { readonly kind: "generateNewFile" }

export type SafetyDecision =
  | { readonly safe: true }
  | { readonly safe: false; readonly reason: string }

const STRUCTURAL_REQUIRES_PRAGMA =
  "Structural editing requires a designer-managed file: add `// @flink-reactor designer` to a fully static pipeline (no loops, conditionals, computed props, or spreads)."

export function decideEditSafety(
  edit: SafetyEditKind,
  fileKind: DesignerFileKind,
  fileKindReason?: string,
): SafetyDecision {
  switch (edit.kind) {
    case "view":
      return { safe: true } // any pipeline renders read-only

    case "scalarProp":
      // Safety is a property of the SOURCE CONSTRUCT, not the file: a literal
      // initializer rewrites in place safely even in an arbitrary file; a
      // computed/identifier/spread prop is never written anywhere.
      return edit.classification === "editable"
        ? { safe: true }
        : {
            safe: false,
            reason:
              "This prop's value is a computed expression, variable reference, or spread — the designer never rewrites those. Use “Edit in source”.",
          }

    case "structural":
    case "freeWiring":
      if (fileKind === "designer-managed") return { safe: true }
      return {
        safe: false,
        reason: fileKindReason ?? STRUCTURAL_REQUIRES_PRAGMA,
      }

    case "regenerateFile":
      // Regenerating/restructuring an existing file from its canvas
      // representation IS the arbitrary round-trip Non-Goal — refused always
      // (greenfield generation writes a NEW file instead).
      return {
        safe: false,
        reason:
          "Regenerating an existing pipeline from the canvas would discard the expressions the file is written with — the designer never does this. Compose a new pipeline instead.",
      }

    case "generateNewFile":
      return { safe: true } // a fresh file clobbers nothing
  }
}
