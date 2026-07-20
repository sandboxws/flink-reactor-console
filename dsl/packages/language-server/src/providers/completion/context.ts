// Completion context classifier.
//
// Decides which completion strategy a cursor position should drive, by walking
// the parsed TSX rather than regexing the line:
//
//   • column-ref      — an identifier slot inside a column-referencing
//                       expression prop (offer the upstream columns)
//   • child-component — a JSX children region (offer valid child tags)
//   • connector-prop  — an attribute-name slot inside an opening tag
//   • enum-value      — the value of a string-literal-union prop
//   • flink-type      — a type-string position inside a `Schema({fields})` call
//
// The contexts are disjoint by AST position; checks run most-specific first so
// the broad children-region case never swallows a more precise one. column-ref
// runs first because an expression-prop string would otherwise be claimed by
// the enum-value case. Parsing is tolerant of mid-edit/malformed JSX
// (TypeScript's error-recovery parser): when the position cannot be classified,
// we return `undefined` so the dispatcher yields no items rather than wrong ones.

import {
  getComponentName,
  getParentTagAtPosition,
} from "@flink-reactor/ts-plugin/rules"
import ts from "typescript"
import {
  columnSlotsFor,
  type Descent,
  descentsMatch,
} from "../../expression-props.js"
import type { SourceRange } from "../../synth/types.js"

/** The cursor sits inside a column-referencing expression prop of an FR
 *  component; offer the owning node's upstream columns. */
export interface ColumnRefContext {
  readonly kind: "column-ref"
  readonly component: string
  readonly prop: string
  /** The text range an accepted column should replace. */
  readonly replace: SourceRange
  /** The partial identifier already typed (for filtering/ranking). */
  readonly partial: string
  /** How to render an inserted identifier (`backtick` for verbatim-SQL slots,
   *  `bare` for codegen-quoted column names). */
  readonly quote: "backtick" | "bare"
}

/** A classified completion position within a FlinkReactor pipeline. */
export type CompletionContext =
  | { readonly kind: "child-component"; readonly parent: string }
  | {
      readonly kind: "connector-prop"
      readonly component: string
      readonly presentProps: readonly string[]
    }
  | {
      readonly kind: "enum-value"
      readonly component: string
      readonly prop: string
    }
  | { readonly kind: "flink-type" }
  | ColumnRefContext

/** Cursor position (zero-based line/character), matching the LSP `Position`. */
export interface ClassifyPosition {
  readonly line: number
  readonly character: number
}

/**
 * Classify the completion position. Returns `undefined` when the cursor matches
 * none of the four contexts (the dispatcher then returns no items).
 */
export function classifyCompletion(
  sourceText: string,
  fileName: string,
  position: ClassifyPosition,
): CompletionContext | undefined {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )
  let offset: number
  try {
    offset = sf.getPositionOfLineAndCharacter(position.line, position.character)
  } catch {
    return undefined // position out of range mid-edit
  }
  const node = findDeepestNode(sf, offset)

  return (
    classifyColumnRef(sf, sourceText, node, offset) ??
    classifyFlinkType(node) ??
    classifyEnumValue(sf, node, offset) ??
    classifyConnectorProp(sf, node, offset) ??
    classifyChildComponent(sf, offset)
  )
}

/**
 * Inside a column-referencing expression prop of an FR component → offer the
 * upstream columns. The cursor may sit in a string value, an array element, or
 * an object key; the slot's AST shape is matched against the component's
 * declared `EXPRESSION_PROPS` paths to confirm it is a column slot and to pick
 * the insert style. Returns `undefined` (defer to other strategies) when the
 * position is not a recognized column slot.
 */
function classifyColumnRef(
  sf: ts.SourceFile,
  sourceText: string,
  node: ts.Node,
  offset: number,
): CompletionContext | undefined {
  // The cursor is on an object-literal KEY, or inside a string value/element.
  const key = asObjectKey(node)
  const str = key ? undefined : findAncestor(node, isStringLike)
  const slot: "value" | "key" = key ? "key" : "value"
  // The node to walk up from: the record holding the key, or the string itself.
  const container = key ? key.parent.parent : str
  const anchor = key ?? str
  if (!container || !anchor) return undefined

  const attr = findAncestor(container, ts.isJsxAttribute)
  if (!attr) return undefined
  const el = findAncestor(attr, isOpeningTag)
  if (!el) return undefined
  const tag = tagText(el.tagName)
  if (!tag) return undefined
  const prop = attrName(attr.name, sf)

  const descents = buildDescents(container, attr)
  if (!descents) return undefined

  const matched = columnSlotsFor(tag).find(
    (s) =>
      s.prop === prop && s.slot === slot && descentsMatch(descents, s.descents),
  )
  if (!matched) return undefined

  const partial = extractPartial(sf, sourceText, anchor, offset, matched.quote)
  if (!partial) return undefined

  return {
    kind: "column-ref",
    component: tag,
    prop,
    replace: partial.range,
    partial: partial.text,
    quote: matched.quote,
  }
}

// ── Classifiers ─────────────────────────────────────────────────────

/** A string value among the `fields` of a `Schema({ ... })` call → a type slot. */
function classifyFlinkType(node: ts.Node): CompletionContext | undefined {
  const str = findAncestor(node, isStringLike)
  if (!str) return undefined
  // str must be the value of a property inside an object literal …
  const valueAssign = str.parent
  if (!valueAssign || !ts.isPropertyAssignment(valueAssign)) return undefined
  if (valueAssign.initializer !== str) return undefined
  const fieldsObject = valueAssign.parent
  if (!fieldsObject || !ts.isObjectLiteralExpression(fieldsObject))
    return undefined
  // … that object is the `fields:` of a `Schema({ ... })` options object.
  const fieldsProp = fieldsObject.parent
  if (
    !fieldsProp ||
    !ts.isPropertyAssignment(fieldsProp) ||
    propertyName(fieldsProp) !== "fields"
  )
    return undefined
  const optionsObject = fieldsProp.parent
  if (!optionsObject || !ts.isObjectLiteralExpression(optionsObject))
    return undefined
  const call = optionsObject.parent
  if (!call || !ts.isCallExpression(call)) return undefined
  if (calleeName(call.expression) !== "Schema") return undefined
  return { kind: "flink-type" }
}

/** A string directly initializing a JSX attribute → an enum-value slot. */
function classifyEnumValue(
  sf: ts.SourceFile,
  node: ts.Node,
  offset: number,
): CompletionContext | undefined {
  const str = findAncestor(node, isStringLike)
  const attr = findAncestor(node, ts.isJsxAttribute)
  if (!attr) return undefined
  // The cursor must be in the attribute's value. Accept either a string
  // initializer (`format="json"`) or an empty/just-opened one mid-edit.
  const init = attr.initializer
  if (!init) return undefined
  if (str && init !== str) {
    // String exists but isn't this attribute's initializer (e.g. nested) —
    // not a direct enum value.
    if (!withinSpan(init, offset, sf)) return undefined
  }
  if (!withinSpan(init, offset, sf)) return undefined
  const el = findAncestor(node, isOpeningTag)
  if (!el) return undefined
  const component = tagText(el.tagName)
  if (!component) return undefined
  return { kind: "enum-value", component, prop: attrName(attr.name, sf) }
}

/** Inside an opening tag, past the tag name, not in a value → an attr-name slot. */
function classifyConnectorProp(
  sf: ts.SourceFile,
  node: ts.Node,
  offset: number,
): CompletionContext | undefined {
  const el = findAncestor(node, isOpeningTag)
  if (!el) return undefined
  const component = tagText(el.tagName)
  if (!component) return undefined
  // Past the tag name (otherwise this is a tag-name position, not props).
  if (offset <= el.tagName.getEnd()) return undefined
  // Not inside any attribute's value (that is the enum-value context).
  for (const attribute of el.attributes.properties) {
    if (
      ts.isJsxAttribute(attribute) &&
      attribute.initializer &&
      withinSpan(attribute.initializer, offset, sf)
    ) {
      return undefined
    }
  }
  const presentProps: string[] = []
  for (const attribute of el.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) {
      presentProps.push(attrName(attribute.name, sf))
    }
  }
  return { kind: "connector-prop", component, presentProps }
}

/** In a JSX children region → offer valid children of the enclosing parent. */
function classifyChildComponent(
  sf: ts.SourceFile,
  offset: number,
): CompletionContext | undefined {
  const parentTag = getParentTagAtPosition(sf, offset, ts)
  if (!parentTag) return undefined
  const parent = getComponentName(parentTag, ts)
  if (!parent) return undefined
  return { kind: "child-component", parent }
}

// ── AST helpers ─────────────────────────────────────────────────────

type OpeningTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement

function isOpeningTag(node: ts.Node): node is OpeningTag {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
}

function isStringLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function withinSpan(node: ts.Node, offset: number, sf: ts.SourceFile): boolean {
  return offset >= node.getStart(sf) && offset <= node.getEnd()
}

/** Nearest ancestor (inclusive of `node`) matching `pred`. */
function findAncestor<T extends ts.Node>(
  node: ts.Node,
  pred: (n: ts.Node) => n is T,
): T | undefined {
  let cur: ts.Node | undefined = node
  while (cur) {
    if (pred(cur)) return cur
    cur = cur.parent
  }
  return undefined
}

/** Deepest AST node whose span contains `offset` (half-open at the end). */
function findDeepestNode(sf: ts.SourceFile, offset: number): ts.Node {
  let deepest: ts.Node = sf
  const visit = (n: ts.Node): void => {
    if (offset >= n.getStart(sf) && offset < n.getEnd()) {
      deepest = n
      n.forEachChild(visit)
    }
  }
  sf.forEachChild(visit)
  return deepest
}

/** Render a JSX tag name, handling dot-notation (`Route.Branch`). */
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

/** The dotted/identifier name of a call expression's callee (`Schema`, `Field.DECIMAL`). */
function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  return undefined
}

function propertyName(assign: ts.PropertyAssignment): string | undefined {
  const name = assign.name
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}

function attrName(name: ts.JsxAttributeName, sf: ts.SourceFile): string {
  return ts.isIdentifier(name) ? name.text : name.getText(sf)
}

// ── Column-slot helpers ─────────────────────────────────────────────

/** The property-name node when `node` is (the name of) an object-literal key. */
function asObjectKey(
  node: ts.Node,
): ts.Identifier | ts.StringLiteral | undefined {
  if (!ts.isIdentifier(node) && !ts.isStringLiteral(node)) return undefined
  const parent = node.parent
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isShorthandPropertyAssignment(parent)) &&
    parent.name === node
  )
    return node
  return undefined
}

/**
 * Walk from a slot container up to the JSX attribute value, recording each
 * structural descent (array element / named-property value). Returns the
 * descents top-down, or `undefined` when an unrecognized node intervenes.
 */
function buildDescents(
  container: ts.Node,
  attr: ts.JsxAttribute,
): Descent[] | undefined {
  const descents: Descent[] = []
  let cur: ts.Node = container
  while (cur.parent && cur.parent !== attr) {
    const parent = cur.parent
    if (ts.isArrayLiteralExpression(parent)) {
      descents.push({ kind: "element" })
    } else if (ts.isPropertyAssignment(parent) && parent.initializer === cur) {
      descents.push({ kind: "key", name: propNameText(parent.name) })
    } else if (
      ts.isObjectLiteralExpression(parent) ||
      ts.isJsxExpression(parent) ||
      ts.isParenthesizedExpression(parent)
    ) {
      // structural pass-through (the `{...}` wrapper, the object, parens)
    } else {
      return undefined // an unrecognized container — not a column slot
    }
    cur = parent
  }
  return descents.reverse()
}

function propNameText(name: ts.PropertyName): string {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  )
    return name.text
  return "" // computed name → matches no named descent
}

/**
 * The partial identifier under the cursor and the range an accepted column
 * replaces. For a back-quoted slot, swallows surrounding back-quotes so
 * re-triggering does not double them. Returns `undefined` when the cursor is on
 * a quote rather than the content.
 */
function extractPartial(
  sf: ts.SourceFile,
  sourceText: string,
  anchor: ts.Node,
  offset: number,
  quote: "backtick" | "bare",
): { range: SourceRange; text: string } | undefined {
  if (ts.isIdentifier(anchor)) {
    return {
      range: toRange(sf, anchor.getStart(sf), anchor.getEnd()),
      text: anchor.text,
    }
  }
  if (!isStringLike(anchor)) return undefined
  const lo = anchor.getStart(sf) + 1 // just inside the opening quote
  const hi = anchor.getEnd() - 1 // just before the closing quote
  if (offset < lo || offset > hi) return undefined
  const isWord = (c: string): boolean => /[A-Za-z0-9_$]/.test(c)
  let wStart = offset
  let wEnd = offset
  while (wStart > lo && isWord(sourceText[wStart - 1])) wStart -= 1
  while (wEnd < hi && isWord(sourceText[wEnd])) wEnd += 1
  let rStart = wStart
  let rEnd = wEnd
  if (quote === "backtick") {
    if (rStart > lo && sourceText[rStart - 1] === "`") rStart -= 1
    if (rEnd < hi && sourceText[rEnd] === "`") rEnd += 1
  }
  return {
    range: toRange(sf, rStart, rEnd),
    text: sourceText.slice(wStart, wEnd),
  }
}

function toRange(sf: ts.SourceFile, start: number, end: number): SourceRange {
  return {
    start: sf.getLineAndCharacterOfPosition(start),
    end: sf.getLineAndCharacterOfPosition(end),
  }
}
