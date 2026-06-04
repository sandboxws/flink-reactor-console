// Per-node prop-editability classification (visual-designer, tasks 2.3–2.4).
//
// The classification depends on the *source form* of each prop — only the AST
// can tell whether `format: "debezium-json"` came from the literal
// `format="debezium-json"` or from `format={WIRE_FORMAT[input]}` — so it is
// computed here, server-side, and shipped on `flinkReactor/designerModel`.
//
// Rules (conservative by default — anything not provably a literal is
// `readOnly`):
//   • string literal (`topic="orders"` / `topic={"orders"}`), number, boolean
//     (`{true}` / bare attribute), or an array/object whose elements are all
//     literals → `editable`, with the current value and the initializer Range.
//   • identifier reference, member/computed expression, call, arrow/function,
//     template with interpolation, or anything else → `readOnly`.
//   • a spread attribute contributes NO entry at all.
//
// Pairing JSX elements to `ConstructNode.id`s reuses the source-position
// mapper's strategy: walk in post-order (creation order) and predict each id
// with `IdPredictor`, filtered against the authoritative id set so computed/
// looped constructs degrade to "unclassified" (= absent → fully read-only on
// the canvas) rather than mislabeling another node.

import ts from "typescript"
import { IdPredictor, type StaticProps } from "../mappers/id-predictor.js"
import type { NodeProjection, SourceRange } from "../synth/types.js"
import type { DesignerPropEntry, DesignerPropValue } from "./model.js"

/** nodeId → its classified prop entries. Nodes synthesis produced but the
 *  walker could not pair (computed props, loops, programmatic createElement)
 *  are absent — the assembler defaults those to "no editable props". */
export type ClassifiedProps = ReadonlyMap<string, readonly DesignerPropEntry[]>

interface CollectedElement {
  readonly tag: string
  readonly props: StaticProps
  readonly entries: readonly DesignerPropEntry[]
}

/**
 * Classify every paired node's props from the document text. Mirrors
 * `buildPositionMap`'s walk so both views of the file agree on which JSX
 * element a node id belongs to.
 */
export function classifyNodeProps(
  sourceText: string,
  fileName: string,
  nodes: readonly NodeProjection[],
): ClassifiedProps {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  const authoritativeComponents = new Set(nodes.map((n) => n.component))
  const elements: CollectedElement[] = []

  const toRange = (start: number, end: number): SourceRange => ({
    start: lineChar(sf, start),
    end: lineChar(sf, end),
  })

  const record = (
    tagName: ts.JsxTagNameExpression,
    attributes: ts.JsxAttributes,
  ): void => {
    const tag = tagText(tagName)
    if (!tag) return
    elements.push({
      tag,
      props: staticProps(attributes, sf),
      entries: classifyAttributes(attributes, sf, toRange),
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      for (const child of node.children) visit(child)
      const open = node.openingElement
      record(open.tagName, open.attributes)
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      record(node.tagName, node.attributes)
      return
    }
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) visit(child)
      return
    }
    // Named factory calls (`FlussSink({…})`) pair to nodes, but their props
    // live in an object literal, not JSX attributes — the designer treats them
    // as fully read-only (the scalar codemod targets JSX attributes only), so
    // record entries with no editable classification.
    if (ts.isCallExpression(node)) {
      const tag = calleeComponentName(node)
      if (tag && authoritativeComponents.has(tag)) {
        for (const arg of node.arguments) visit(arg)
        elements.push({
          tag,
          props: factoryProps(node.arguments[0]),
          entries: readOnlyFactoryEntries(node.arguments[0]),
        })
        return
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sf, visit)

  const predictor = new IdPredictor()
  const authoritative = new Set(nodes.map((n) => n.id))
  const byId = new Map<string, readonly DesignerPropEntry[]>()
  for (const el of elements) {
    const id = predictor.predict(el.tag, el.props)
    if (!authoritative.has(id)) continue
    if (!byId.has(id)) byId.set(id, el.entries)
  }
  return byId
}

// ── Attribute classification ─────────────────────────────────────────

function classifyAttributes(
  attrs: ts.JsxAttributes,
  sf: ts.SourceFile,
  toRange: (start: number, end: number) => SourceRange,
): readonly DesignerPropEntry[] {
  const entries: DesignerPropEntry[] = []
  for (const prop of attrs.properties) {
    // A spread contributes no editable entry (task 2.3).
    if (!ts.isJsxAttribute(prop)) continue
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    entries.push(classifyAttribute(name, prop, sf, toRange))
  }
  return entries
}

function classifyAttribute(
  name: string,
  prop: ts.JsxAttribute,
  sf: ts.SourceFile,
  toRange: (start: number, end: number) => SourceRange,
): DesignerPropEntry {
  const init = prop.initializer

  // Bare boolean attribute (`tap`) — the literal `true`.
  if (!init) {
    return {
      name,
      classification: "editable",
      value: true,
      valueKind: "boolean",
      range: toRange(prop.name.getStart(sf), prop.name.getEnd()),
    }
  }

  // `topic="orders"` — the common literal string form.
  if (ts.isStringLiteral(init)) {
    return editable(name, init.text, "string", init, sf, toRange)
  }

  if (ts.isJsxExpression(init) && init.expression) {
    const expr = init.expression
    const lit = literalValue(expr)
    if (lit) {
      return editable(name, lit.value, lit.kind, expr, sf, toRange)
    }
  }

  // Conservative default (task 2.4): identifier, member/computed access,
  // call, arrow/function, interpolated template, empty expression, …
  return { name, classification: "readOnly" }
}

function editable(
  name: string,
  value: DesignerPropValue,
  valueKind: NonNullable<DesignerPropEntry["valueKind"]>,
  node: ts.Node,
  sf: ts.SourceFile,
  toRange: (start: number, end: number) => SourceRange,
): DesignerPropEntry {
  return {
    name,
    classification: "editable",
    value,
    valueKind,
    range: toRange(node.getStart(sf), node.getEnd()),
  }
}

interface LiteralResult {
  readonly value: DesignerPropValue
  readonly kind: NonNullable<DesignerPropEntry["valueKind"]>
}

/** Resolve an expression to a literal value, or `undefined` when it is not
 *  provably a literal. Arrays/objects qualify only when every element does. */
function literalValue(expr: ts.Expression): LiteralResult | undefined {
  const scalar = scalarLiteral(expr)
  if (scalar !== undefined) return scalar

  if (ts.isArrayLiteralExpression(expr)) {
    const items: (string | number | boolean)[] = []
    for (const element of expr.elements) {
      const lit = scalarLiteral(element)
      if (!lit || Array.isArray(lit.value)) return undefined
      items.push(lit.value as string | number | boolean)
    }
    return { value: items, kind: "array" }
  }

  if (ts.isObjectLiteralExpression(expr)) {
    const obj: Record<string, unknown> = {}
    for (const member of expr.properties) {
      if (!ts.isPropertyAssignment(member)) return undefined // spread/shorthand/method
      const key = ts.isIdentifier(member.name)
        ? member.name.text
        : ts.isStringLiteral(member.name)
          ? member.name.text
          : undefined
      if (key === undefined) return undefined // computed key
      const lit = literalValue(member.initializer)
      if (!lit) return undefined
      obj[key] = lit.value
    }
    return { value: obj, kind: "object" }
  }

  return undefined
}

function scalarLiteral(expr: ts.Expression): LiteralResult | undefined {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { value: expr.text, kind: "string" }
  }
  if (ts.isNumericLiteral(expr)) {
    return { value: Number(expr.text), kind: "number" }
  }
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return { value: -Number(expr.operand.text), kind: "number" }
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return { value: true, kind: "boolean" }
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return { value: false, kind: "boolean" }
  }
  return undefined
}

/** Factory-call props (`FlussSink({ database: "db", … })`) are read-only by
 *  design — surface their names so the form can render them, never their
 *  ranges (the codemod is JSX-only). */
function readOnlyFactoryEntries(
  arg: ts.Expression | undefined,
): readonly DesignerPropEntry[] {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return []
  const entries: DesignerPropEntry[] = []
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = ts.isIdentifier(prop.name)
      ? prop.name.text
      : ts.isStringLiteral(prop.name)
        ? prop.name.text
        : undefined
    if (key === undefined || key === "children") continue
    entries.push({ name: key, classification: "readOnly" })
  }
  return entries
}

// ── Shared helpers (mirror source-position-mapper) ───────────────────

function lineChar(
  sf: ts.SourceFile,
  pos: number,
): { line: number; character: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos)
  return { line: lc.line, character: lc.character }
}

function tagText(tagName: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tagName)) return tagName.text
  if (ts.isPropertyAccessExpression(tagName)) {
    const left = ts.isIdentifier(tagName.expression)
      ? tagName.expression.text
      : undefined
    if (!left) return undefined
    return `${left}.${tagName.name.text}`
  }
  return undefined
}

function staticProps(attrs: ts.JsxAttributes, sf: ts.SourceFile): StaticProps {
  const props: StaticProps = {}
  for (const prop of attrs.properties) {
    if (!ts.isJsxAttribute(prop)) continue
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    const value = stringValue(prop.initializer)
    if (value !== undefined) props[name] = value
  }
  return props
}

function stringValue(init: ts.JsxAttribute["initializer"]): string | undefined {
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) {
    if (
      ts.isStringLiteral(init.expression) ||
      ts.isNoSubstitutionTemplateLiteral(init.expression)
    ) {
      return init.expression.text
    }
  }
  return undefined
}

function calleeComponentName(node: ts.CallExpression): string | undefined {
  const callee = node.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression)
  )
    return `${callee.expression.text}.${callee.name.text}`
  return undefined
}

function factoryProps(arg: ts.Expression | undefined): StaticProps {
  const props: StaticProps = {}
  if (!arg || !ts.isObjectLiteralExpression(arg)) return props
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = ts.isIdentifier(prop.name)
      ? prop.name.text
      : ts.isStringLiteral(prop.name)
        ? prop.name.text
        : undefined
    if (!key) continue
    if (
      ts.isStringLiteral(prop.initializer) ||
      ts.isNoSubstitutionTemplateLiteral(prop.initializer)
    ) {
      props[key] = prop.initializer.text
    }
  }
  return props
}
