// Completion context classifier.
//
// Decides which of four completion strategies a cursor position should drive,
// by walking the parsed TSX rather than regexing the line:
//
//   • child-component — a JSX children region (offer valid child tags)
//   • connector-prop  — an attribute-name slot inside an opening tag
//   • enum-value      — the value of a string-literal-union prop
//   • flink-type      — a type-string position inside a `Schema({fields})` call
//
// The contexts are disjoint by AST position; checks run most-specific first so
// the broad children-region case never swallows a more precise one. Parsing is
// tolerant of mid-edit/malformed JSX (TypeScript's error-recovery parser): when
// the position cannot be classified, we return `undefined` so the dispatcher
// yields no items rather than wrong ones.

import {
  getComponentName,
  getParentTagAtPosition,
} from "@flink-reactor/ts-plugin/rules"
import ts from "typescript"

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
    classifyFlinkType(node) ??
    classifyEnumValue(sf, node, offset) ??
    classifyConnectorProp(sf, node, offset) ??
    classifyChildComponent(sf, offset)
  )
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
