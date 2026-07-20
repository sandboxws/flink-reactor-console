// Designer-pragma detection + static-subset verification (task 4.1).
//
// `// @flink-reactor designer` asserts a file is a static, designer-managed
// subset, which is what makes structural `ts-morph` codemods safe by
// construction. The pragma is a CLAIM THAT IS CHECKED, NOT TRUSTED: before
// every structural edit (and on every `designerModel` build) the file is
// re-verified against the contract, and a violation refuses the edit with the
// specific reason.
//
// The contract (what dynamic construction would make a structural codemod
// unsafe):
//   • no loops (`for`/`for-in`/`for-of`/`while`/`do`)
//   • no conditionals (`if` statements, ternary expressions)
//   • no spreads anywhere (JSX spread attributes, `...` array/object spreads)
//   • no computed JSX props — every JSX attribute initializer must be a
//     literal (string/number/boolean/array/object of literals) or a *bare
//     identifier reference* (how schemas are wired: `schema={OrdersSchema}`);
//     member/element access, calls, arrows, and interpolated templates fail
//   • no dynamic JSX children — no `{expression}` containers between tags
//     (that is how `.map(...)` loops and `cond && <X/>` conditionals smuggle
//     dynamic structure in)
//
// Bare identifiers are deliberately allowed: the classification vocabulary
// (designerModel) distinguishes "identifier reference" from "computed
// expression", and identifier props move wholesale with their element during
// structural edits — no re-evaluation is implied. Without this, every real
// pipeline (`schema={OrdersSchema}`) would fail the contract, including the
// files the greenfield generator itself emits.

import ts from "typescript"
import type { DesignerFileKind } from "./model.js"

/** The designer-managed pragma, matched on a line of its own near the top. */
export const DESIGNER_PRAGMA = "@flink-reactor designer"

/** Resolve the document's file kind for the edit-safety matrix: pragma absent
 *  → `arbitrary`; pragma present + contract satisfied → `designer-managed`;
 *  pragma present + violation → `pragma-violated` (with the specific reason).
 *  One implementation shared by the model assembler and the write path so the
 *  canvas affordances and the server's refusals can never disagree. */
export function resolveFileKind(
  sourceText: string,
  fileName: string,
): { fileKind: DesignerFileKind; fileKindReason?: string } {
  const subset = verifyStaticSubset(sourceText, fileName)
  if (!subset.pragmaPresent) {
    return {
      fileKind: "arbitrary",
      fileKindReason:
        "Structural editing requires a designer-managed file (add `// @flink-reactor designer` to a fully static pipeline).",
    }
  }
  if (subset.violations.length > 0) {
    const first = subset.violations[0]
    return {
      fileKind: "pragma-violated",
      fileKindReason: `File no longer satisfies the designer static-subset contract: ${first?.reason} (line ${(first?.line ?? 0) + 1}).`,
    }
  }
  return { fileKind: "designer-managed" }
}

export interface StaticSubsetViolation {
  readonly reason: string
  readonly line: number
}

export interface StaticSubsetResult {
  readonly pragmaPresent: boolean
  /** Empty iff the file satisfies the static-subset contract. */
  readonly violations: readonly StaticSubsetViolation[]
}

export function hasDesignerPragma(sourceText: string): boolean {
  // Match a `//` comment containing the pragma in the leading comment block
  // (before any non-comment content) — same family as `@jsxImportSource`.
  for (const line of sourceText.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    if (trimmed.startsWith("//")) {
      if (trimmed.includes(DESIGNER_PRAGMA)) return true
      continue
    }
    if (trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      if (trimmed.includes(DESIGNER_PRAGMA)) return true
      continue
    }
    break // first real code line — pragma must precede it
  }
  return false
}

/**
 * Verify the static-subset contract over the whole file. Pure AST walk —
 * no synthesis, no type checking — so it is cheap enough to run on every
 * structural edit and every model build.
 */
export function verifyStaticSubset(
  sourceText: string,
  fileName: string,
): StaticSubsetResult {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )
  const violations: StaticSubsetViolation[] = []
  const flag = (node: ts.Node, reason: string): void => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    violations.push({ reason, line })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIterationStatement(node, /* lookInLabeledStatements */ true)) {
      flag(node, "contains a loop")
    } else if (ts.isIfStatement(node)) {
      flag(node, "contains a conditional (`if`)")
    } else if (ts.isConditionalExpression(node)) {
      flag(node, "contains a conditional (ternary) expression")
    } else if (
      ts.isJsxSpreadAttribute(node) ||
      ts.isSpreadElement(node) ||
      ts.isSpreadAssignment(node)
    ) {
      flag(node, "contains a spread")
    } else if (ts.isJsxAttribute(node)) {
      const offending = computedAttributeReason(node)
      if (offending) flag(node, offending)
    } else if (
      ts.isJsxExpression(node) &&
      node.expression !== undefined &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      // `{expression}` in a CHILDREN position — dynamic structure. (An empty
      // container — a `{/* comment */}` — is static and allowed.)
      flag(node, "contains a dynamic JSX child expression")
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)

  return { pragmaPresent: hasDesignerPragma(sourceText), violations }
}

/** A JSX attribute violates the contract when its initializer is neither a
 *  literal (incl. literal arrays/objects) nor a bare identifier. */
function computedAttributeReason(attr: ts.JsxAttribute): string | undefined {
  const init = attr.initializer
  if (!init) return undefined // bare boolean attribute
  if (ts.isStringLiteral(init)) return undefined
  if (!ts.isJsxExpression(init) || !init.expression) {
    return "contains an empty JSX attribute expression"
  }
  const name = ts.isIdentifier(attr.name) ? attr.name.text : "prop"
  return isStaticInitializer(init.expression)
    ? undefined
    : `contains a computed prop (\`${name}\`)`
}

function isStaticInitializer(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) return true // schema={OrdersSchema}
  if (
    ts.isStringLiteral(expr) ||
    ts.isNoSubstitutionTemplateLiteral(expr) ||
    ts.isNumericLiteral(expr) ||
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return true
  }
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return true
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return expr.elements.every((e) => isStaticInitializer(e))
  }
  if (ts.isObjectLiteralExpression(expr)) {
    return expr.properties.every(
      (p) =>
        ts.isPropertyAssignment(p) &&
        !ts.isComputedPropertyName(p.name) &&
        isStaticInitializer(p.initializer),
    )
  }
  return false
}
