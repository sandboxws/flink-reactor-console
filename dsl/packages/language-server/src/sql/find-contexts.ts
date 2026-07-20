// Locate every embedded-SQL fragment in a pipeline `.tsx` and return each one's
// absolute source offset, raw text, and context kind (task 5.1). Works purely
// over the parsed AST — independent of whether `synthesizeApp()` succeeded — so
// coloring ranges survive validation/synthesis errors (spec: "Semantic tokens
// survive a synthesis failure"). Three structural shapes are covered:
//
//   • JSX attribute SQL — scalar (`condition="…"`, `on="…"`) and object-valued
//     (`select={{ k: "…" }}`, `rules={{ expression: { k: "…" } }}`), driven by
//     the shared registry's `EXPRESSION_PROPS`-derived slots.
//   • `RawSQL`'s `sql` body (a JSX string attribute, not in EXPRESSION_PROPS).
//   • `Schema({ watermark: { expression: "…" } })` — a call expression, walked
//     directly since schemas never reach the synthesis source map.
//
// A computed/interpolated value (anything not a plain string/no-substitution
// template literal) yields no fragment — the graceful "fall back to plain
// string" path both layers share.

import ts from "typescript"
import type { Descent } from "../expression-props.js"
import {
  kindForJsxSlot,
  RAWSQL_SQL_PROP,
  RAWSQL_TAG,
  SCHEMA_CALLEE,
  type SqlContextKind,
  sqlSlotsFor,
  WATERMARK_EXPRESSION_KEY,
  WATERMARK_KEY,
} from "./context-registry.js"

/** One embedded-SQL fragment located in the source, ready to tokenize. */
export interface SqlContext {
  /** Absolute 0-based offset of the fragment's first character (inside the
   *  opening quote) in the document. */
  readonly startOffset: number
  /** The raw fragment text — the source slice between the quotes (escapes left
   *  verbatim so token offsets stay aligned with the document). */
  readonly text: string
  readonly kind: SqlContextKind
}

/**
 * Find all embedded-SQL fragments in `sf`. `sourceText` must be the exact buffer
 * `sf` was parsed from so the returned offsets index it directly.
 */
export function findSqlContexts(
  sf: ts.SourceFile,
  sourceText: string,
): SqlContext[] {
  const contexts: SqlContext[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      collectJsxContexts(node, sf, sourceText, contexts)
    } else if (
      ts.isCallExpression(node) &&
      calleeName(node) === SCHEMA_CALLEE
    ) {
      collectWatermarkContext(node, sf, sourceText, contexts)
    }
    node.forEachChild(visit)
  }
  sf.forEachChild(visit)

  return contexts
}

// ── JSX attributes (registry slots + RawSQL body) ────────────────────────

function collectJsxContexts(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
  sourceText: string,
  out: SqlContext[],
): void {
  const tag = tagText(el.tagName)
  if (!tag) return

  // RawSQL's `sql` body is a scalar SQL string prop, but RawSQL is not an
  // EXPRESSION_PROPS component — handle it explicitly.
  if (tag === RAWSQL_TAG) {
    const value = attributeValue(el, RAWSQL_SQL_PROP)
    if (value) emitLeaf(value, [], "rawsql-body", sf, sourceText, out)
  }

  for (const slot of sqlSlotsFor(tag)) {
    const value = attributeValue(el, slot.prop)
    if (!value) continue
    emitLeaf(
      value,
      slot.descents,
      kindForJsxSlot(slot.prop),
      sf,
      sourceText,
      out,
    )
  }
}

/** The value expression of attribute `prop` on `el`: the string literal for
 *  `="x"`, or the inner expression for `={…}`. `undefined` for a missing or
 *  bare-boolean attribute. */
function attributeValue(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  prop: string,
): ts.Expression | undefined {
  for (const attr of el.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue
    if (attrNameText(attr.name) !== prop) continue
    const init = attr.initializer
    if (!init) return undefined
    if (ts.isStringLiteral(init)) return init
    if (ts.isJsxExpression(init)) return init.expression
    return undefined
  }
  return undefined
}

// ── Schema watermark ─────────────────────────────────────────────────────

function collectWatermarkContext(
  call: ts.CallExpression,
  sf: ts.SourceFile,
  sourceText: string,
  out: SqlContext[],
): void {
  const options = call.arguments[0]
  if (!options || !ts.isObjectLiteralExpression(options)) return
  const watermark = propertyValue(options, WATERMARK_KEY)
  if (!watermark || !ts.isObjectLiteralExpression(watermark)) return
  const expression = propertyValue(watermark, WATERMARK_EXPRESSION_KEY)
  if (expression) emitLeaf(expression, [], "watermark", sf, sourceText, out)
}

// ── Descent walking → leaf string literals ───────────────────────────────

/**
 * Walk `expr` following `descents` (from the shared registry's slot) down to its
 * leaf string literal(s) and emit a context for each. A descent into an object
 * literal that isn't there, or a leaf that is a computed expression, simply
 * yields nothing — the graceful fallback.
 */
function emitLeaf(
  expr: ts.Expression,
  descents: readonly Descent[],
  kind: SqlContextKind,
  sf: ts.SourceFile,
  sourceText: string,
  out: SqlContext[],
): void {
  if (descents.length === 0) {
    const content = stringContent(expr, sf, sourceText)
    if (content) out.push({ ...content, kind })
    return
  }
  const [descent, ...rest] = descents
  if (!ts.isObjectLiteralExpression(expr)) return

  if (descent.kind === "anyValue") {
    for (const prop of expr.properties) {
      const value = propertyInitializer(prop)
      if (value) emitLeaf(value, rest, kind, sf, sourceText, out)
    }
  } else if (descent.kind === "key") {
    const value = propertyValue(expr, descent.name)
    if (value) emitLeaf(value, rest, kind, sf, sourceText, out)
  }
  // `element` descents never occur for SQL slots (those are bare-column `[]`).
}

/** The content offset + raw text of a string / no-substitution template literal,
 *  or `undefined` for any other (computed/interpolated) expression. */
function stringContent(
  expr: ts.Expression,
  sf: ts.SourceFile,
  sourceText: string,
): { startOffset: number; text: string } | undefined {
  if (!ts.isStringLiteral(expr) && !ts.isNoSubstitutionTemplateLiteral(expr)) {
    return undefined
  }
  // Span includes the surrounding quotes/backticks; the content is between them.
  // Trim a leading quote always, and a trailing quote only when the literal is
  // terminated (a mid-edit unterminated literal has none to trim).
  const start = expr.getStart(sf) + 1
  const rawEnd = expr.getEnd()
  const lastChar = sourceText[rawEnd - 1]
  const terminated = lastChar === "'" || lastChar === '"' || lastChar === "`"
  const end = terminated ? rawEnd - 1 : rawEnd
  if (end < start) return undefined
  return { startOffset: start, text: sourceText.slice(start, end) }
}

// ── Small AST helpers (kept local so `sql/` stays self-contained) ─────────

/** A property's value within an object literal, by key. */
function propertyValue(
  obj: ts.ObjectLiteralExpression,
  key: string,
): ts.Expression | undefined {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && propertyKeyText(prop.name) === key) {
      return prop.initializer
    }
  }
  return undefined
}

/** The initializer of an object-literal property (skips spreads/methods). */
function propertyInitializer(
  prop: ts.ObjectLiteralElementLike,
): ts.Expression | undefined {
  return ts.isPropertyAssignment(prop) ? prop.initializer : undefined
}

function propertyKeyText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}

function attrNameText(name: ts.JsxAttributeName): string {
  return ts.isIdentifier(name) ? name.text : name.getText()
}

/** Render a JSX tag name, handling dot-notation (`Query.Where`). */
function tagText(tagName: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tagName)) return tagName.text || undefined
  if (
    ts.isPropertyAccessExpression(tagName) &&
    ts.isIdentifier(tagName.expression)
  ) {
    return `${tagName.expression.text}.${tagName.name.text}`
  }
  return undefined
}

/** The identifier/dotted name of a call's callee (`Schema`, `Field.DECIMAL`). */
function calleeName(call: ts.CallExpression): string | undefined {
  const expr = call.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  return undefined
}
