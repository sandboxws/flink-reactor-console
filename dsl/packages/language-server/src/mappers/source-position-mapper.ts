import ts from "typescript"
import type { NodeProjection, SourceRange } from "../synth/types.js"
import { IdPredictor, type StaticProps } from "./id-predictor.js"

export interface PositionMapMismatch {
  readonly jsxElementCount: number
  readonly constructNodeCount: number
  /** Authoritative node ids synthesis produced that could not be located in
   *  the source (their diagnostics fall back to the file top). */
  readonly unmappedNodeIds: readonly string[]
  readonly message: string
}

export interface PositionMap {
  /** ConstructNode id → source range. */
  readonly map: ReadonlyMap<string, SourceRange>
  /** ConstructNode id → (prop name → that prop's value range in source). Lets
   *  a diagnostic narrow from the whole element to the offending prop (e.g. a
   *  `<Filter>` `condition`). Only literal-valued attributes are recorded. */
  readonly propRanges: ReadonlyMap<string, ReadonlyMap<string, SourceRange>>
  /** Set when the JSX element count diverges from the ConstructNode count. */
  readonly mismatch?: PositionMapMismatch
  /** True when ranges came from authoritative `__loc` rather than prediction. */
  readonly fromLoc: boolean
}

interface CollectedElement {
  readonly tag: string
  readonly props: StaticProps
  readonly range: SourceRange
  /** prop name → value range, for prop-span narrowing. */
  readonly propRanges: ReadonlyMap<string, SourceRange>
}

/**
 * Build a `nodeId → Range` map for a pipeline document.
 *
 * Strategy:
 *  1. If every ConstructNode carries an authoritative `__loc` (a future DSL
 *     dev-runtime feature), use it directly — no prediction.
 *  2. Otherwise parse the `.tsx`, walk JSX/`createElement` in **post-order**
 *     (children before parent — the order `createElement` actually runs), and
 *     predict each node's id with `IdPredictor`.
 *
 * When the JSX element count disagrees with the ConstructNode count (e.g.
 * programmatic `createElement` interleaved with JSX, or computed children), a
 * mismatch is reported and only successfully paired nodes are mapped.
 */
export function buildPositionMap(
  sourceText: string,
  fileName: string,
  nodes?: readonly NodeProjection[],
): PositionMap {
  // ── 1. __loc fast-path ──────────────────────────────────────────────
  if (nodes && nodes.length > 0 && nodes.every((n) => n.loc)) {
    const map = new Map<string, SourceRange>()
    for (const n of nodes) if (n.loc) map.set(n.id, n.loc)
    return { map, propRanges: new Map(), fromLoc: true }
  }

  // ── 2. Prediction path ──────────────────────────────────────────────
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  const elements: CollectedElement[] = []

  const toRange = (start: number, end: number): SourceRange => ({
    start: lineChar(sf, start),
    end: lineChar(sf, end),
  })

  const record = (
    tagName: ts.JsxTagNameExpression,
    attributes: ts.JsxAttributes,
    rangeStart: number,
    rangeEnd: number,
  ): void => {
    const tag = tagText(tagName)
    if (!tag) return
    elements.push({
      tag,
      props: staticProps(attributes, sf),
      range: toRange(rangeStart, rangeEnd),
      propRanges: propValueRanges(attributes, sf, toRange),
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      // Children are created before the parent → recurse first (post-order).
      for (const child of node.children) visit(child)
      const open = node.openingElement
      // Point the range at the opening tag, not the whole subtree.
      record(open.tagName, open.attributes, open.getStart(sf), open.getEnd())
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      record(node.tagName, node.attributes, node.getStart(sf), node.getEnd())
      return
    }
    if (ts.isJsxFragment(node)) {
      // Fragments produce no ConstructNode — recurse children only.
      for (const child of node.children) visit(child)
      return
    }
    if (isElementFactoryCall(node)) {
      // `createElement(tag, props, ...children)` — recurse children (args 2+)
      // before recording, matching argument-evaluation order.
      const [tagArg, propsArg, ...childArgs] = node.arguments
      for (const child of childArgs) visit(child)
      const tag = factoryTag(tagArg)
      if (tag) {
        elements.push({
          tag,
          props: factoryProps(propsArg),
          range: toRange(node.getStart(sf), node.getEnd()),
          // Prop-span narrowing is JSX-only; programmatic `createElement`
          // object literals are not narrowed (design: narrow only literal
          // JSX attributes), so no per-prop ranges are recorded here.
          propRanges: new Map(),
        })
      }
      // Still descend into the tag/props args for any nested JSX.
      if (tagArg) visit(tagArg)
      if (propsArg) visit(propsArg)
      return
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sf, visit)

  // Predict ids over the collected elements (already in post-order). When the
  // authoritative id set is known, use it as a filter: a predicted id that
  // synthesis never produced (computed props, programmatic createElement) is
  // dropped rather than used to mislocate a diagnostic.
  const predictor = new IdPredictor()
  const authoritative = nodes ? new Set(nodes.map((n) => n.id)) : null
  const map = new Map<string, SourceRange>()
  const propRanges = new Map<string, ReadonlyMap<string, SourceRange>>()
  for (const el of elements) {
    const id = predictor.predict(el.tag, el.props)
    if (authoritative && !authoritative.has(id)) continue
    if (!map.has(id)) {
      map.set(id, el.range)
      if (el.propRanges.size > 0) propRanges.set(id, el.propRanges)
    }
  }

  // ── Mismatch detection (4.5) ────────────────────────────────────────
  // The precise signal is "authoritative nodes we failed to locate", which
  // also catches same-count-but-drifted cases that a raw count check misses.
  let mismatch: PositionMapMismatch | undefined
  if (authoritative) {
    const unmappedNodeIds = [...authoritative].filter((id) => !map.has(id))
    if (unmappedNodeIds.length > 0) {
      mismatch = {
        jsxElementCount: elements.length,
        constructNodeCount: authoritative.size,
        unmappedNodeIds,
        message:
          `Source-position mapping is approximate: ${unmappedNodeIds.length} of ` +
          `${authoritative.size} construct node(s) could not be located in the source ` +
          "(usually programmatic createElement() or computed/looped children). " +
          "Diagnostics for those nodes fall back to the file top.",
      }
    }
  }

  return { map, propRanges, mismatch, fromLoc: false }
}

/** A 0-based source position (mirrors LSP `Position`). */
export interface SourcePosition {
  readonly line: number
  readonly character: number
}

/**
 * The **innermost** node whose source range contains `position`, or `null`.
 * This is the inverse of the `nodeId → Range` map: it turns a caret/selection
 * position into the most specific node under it, so the SQL preview can resolve
 * "which node is the author looking at" for DSL→SQL highlighting. When ranges
 * nest (a child element inside its parent), the smallest containing range wins.
 */
export function nodeAtPosition(
  positionMap: PositionMap,
  position: SourcePosition,
): string | null {
  let best: { id: string; size: number } | null = null
  for (const [id, range] of positionMap.map) {
    if (!rangeContains(range, position)) continue
    const size = rangeSpan(range)
    if (!best || size < best.size) best = { id, size }
  }
  return best?.id ?? null
}

/** Half-open-ish containment: a position on either boundary counts as inside so
 *  a caret resting at the very start/end of an element still resolves to it. */
function rangeContains(range: SourceRange, p: SourcePosition): boolean {
  const afterStart =
    p.line > range.start.line ||
    (p.line === range.start.line && p.character >= range.start.character)
  const beforeEnd =
    p.line < range.end.line ||
    (p.line === range.end.line && p.character <= range.end.character)
  return afterStart && beforeEnd
}

/** A monotonic span measure for "smallest range wins" — line distance dominates
 *  so a multi-line parent always outranks a single-line child. */
function rangeSpan(range: SourceRange): number {
  const LINE_WEIGHT = 1_000_000
  return (
    (range.end.line - range.start.line) * LINE_WEIGHT +
    (range.end.character - range.start.character)
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Capture each literal-valued JSX attribute's **value** range (the squiggle
 *  unit for prop-span narrowing). Boolean attributes (no initializer) map to
 *  the attribute name's range. Spread/computed attributes are skipped. */
function propValueRanges(
  attrs: ts.JsxAttributes,
  sf: ts.SourceFile,
  toRange: (start: number, end: number) => SourceRange,
): ReadonlyMap<string, SourceRange> {
  const ranges = new Map<string, SourceRange>()
  for (const prop of attrs.properties) {
    if (!ts.isJsxAttribute(prop)) continue // skip spread
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    const target = propValueNode(prop)
    if (!target) continue
    ranges.set(name, toRange(target.getStart(sf), target.getEnd()))
  }
  return ranges
}

/** The AST node whose span best represents an attribute's value: the string
 *  literal (for `="x"`), the inner literal (for `={"x"}`), or the attribute
 *  name itself (boolean attribute). Non-literal expressions are not narrowed. */
function propValueNode(prop: ts.JsxAttribute): ts.Node | undefined {
  const init = prop.initializer
  if (!init) return prop.name // boolean attribute → name span
  if (ts.isStringLiteral(init)) return init
  if (ts.isJsxExpression(init) && init.expression) {
    if (
      ts.isStringLiteral(init.expression) ||
      ts.isNoSubstitutionTemplateLiteral(init.expression)
    ) {
      return init.expression
    }
    return undefined // computed expression → don't narrow
  }
  return undefined
}

function lineChar(
  sf: ts.SourceFile,
  pos: number,
): { line: number; character: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos)
  return { line: lc.line, character: lc.character }
}

/** Render a JSX tag name, handling dot-notation (`Route.Branch`,
 *  `Query.Select`, `SideOutput.Sink`, `Validate.Reject`, …). */
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

/** Extract static (string-literal) JSX attributes into a prop bag. */
function staticProps(attrs: ts.JsxAttributes, sf: ts.SourceFile): StaticProps {
  const props: StaticProps = {}
  for (const prop of attrs.properties) {
    if (!ts.isJsxAttribute(prop)) continue // skip spread
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    const value = stringValue(prop.initializer)
    if (value !== undefined) props[name] = value
  }
  return props
}

/** Pull a string out of a JSX attribute initializer (`="x"` or `={"x"}`). */
function stringValue(init: ts.JsxAttribute["initializer"]): string | undefined {
  if (!init) return undefined // boolean attribute
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

const FACTORY_NAMES = new Set(["createElement", "jsx", "jsxs", "jsxDEV"])

function isElementFactoryCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return FACTORY_NAMES.has(callee.text)
  if (ts.isPropertyAccessExpression(callee))
    return FACTORY_NAMES.has(callee.name.text)
  return false
}

/** Tag from a `createElement` first argument (string literal or identifier). */
function factoryTag(arg: ts.Expression | undefined): string | undefined {
  if (!arg) return undefined
  if (ts.isStringLiteral(arg)) return arg.text
  if (ts.isIdentifier(arg)) return arg.text
  if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
    return `${arg.expression.text}.${arg.name.text}`
  }
  return undefined
}

/** Static props from a `createElement` second (object literal) argument. */
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
