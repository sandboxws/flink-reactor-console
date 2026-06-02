// Token classification for hover.
//
// Once `resolve.ts` has the node under the cursor, this decides *what* inside
// the element was hovered: the component tag name, a connector attribute name,
// or an identifier inside a recognized SQL-expression prop (a column reference).
// It walks the parsed TSX rather than regexing the line, so it never confuses a
// column reference with a SQL keyword/function/string literal.
//
// Parsing here (one `createSourceFile` per hover) is intentional: the Tier-0
// mapper discards its parse, hover is user-initiated and infrequent, and a
// single-file scan is sub-millisecond. The classifier stays a pure function so
// it is trivially unit-testable.

import ts from "typescript"
import { isExpressionProp } from "../expression-props.js"
import type { SourceRange } from "../synth/types.js"
import type { Position } from "./resolve.js"

/** What the cursor is on, within a resolved FlinkReactor element. */
export type ClassifiedToken =
  | { readonly kind: "tag"; readonly tag: string; readonly range: SourceRange }
  | {
      readonly kind: "prop"
      readonly tag: string
      readonly prop: string
      readonly range: SourceRange
    }
  | {
      readonly kind: "column-ref"
      readonly tag: string
      readonly prop: string
      readonly ident: string
      readonly range: SourceRange
    }

/**
 * Classify the token at `position`. Returns `undefined` when the cursor is not
 * on a JSX tag name, a JSX attribute name, or a column identifier inside a
 * SQL-expression prop — letting the provider defer to the ts-plugin.
 */
export function classifyToken(
  sourceText: string,
  fileName: string,
  position: Position,
): ClassifiedToken | undefined {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )
  const offset = sf.getPositionOfLineAndCharacter(
    position.line,
    position.character,
  )
  const node = findDeepestNode(sf, offset)

  return (
    classifyTag(sf, node) ??
    classifyProp(sf, node) ??
    classifyColumnRef(sf, sourceText, node, offset)
  )
}

// ── Classifiers ─────────────────────────────────────────────────────

function classifyTag(
  sf: ts.SourceFile,
  node: ts.Node,
): ClassifiedToken | undefined {
  const el = findAncestor(node, isTagHolder)
  if (!el) return undefined
  const tagName = el.tagName
  // The cursor must be on the tag name itself, not on an attribute.
  if (
    node.getStart(sf) < tagName.getStart(sf) ||
    node.getEnd() > tagName.getEnd()
  )
    return undefined
  const tag = tagText(tagName)
  if (!tag) return undefined
  return {
    kind: "tag",
    tag,
    range: toRange(sf, tagName.getStart(sf), tagName.getEnd()),
  }
}

function classifyProp(
  sf: ts.SourceFile,
  node: ts.Node,
): ClassifiedToken | undefined {
  const attr = findAncestor(node, ts.isJsxAttribute)
  if (!attr) return undefined
  const name = attr.name
  // The cursor must be on the attribute name, not its value.
  if (node.getStart(sf) < name.getStart(sf) || node.getEnd() > name.getEnd())
    return undefined
  const el = findAncestor(node, isTagHolder)
  if (!el) return undefined
  const tag = tagText(el.tagName)
  if (!tag) return undefined
  return {
    kind: "prop",
    tag,
    prop: attrName(name, sf),
    range: toRange(sf, name.getStart(sf), name.getEnd()),
  }
}

function classifyColumnRef(
  sf: ts.SourceFile,
  sourceText: string,
  node: ts.Node,
  offset: number,
): ClassifiedToken | undefined {
  const str = findAncestor(node, isStringLike)
  if (!str) return undefined
  const attr = findAncestor(str, ts.isJsxAttribute)
  if (!attr) return undefined
  const el = findAncestor(str, isTagHolder)
  if (!el) return undefined
  const tag = tagText(el.tagName)
  if (!tag) return undefined
  const prop = attrName(attr.name, sf)
  if (!isExpressionProp(tag, prop)) return undefined

  // Identifier under the cursor, bounded to the string's content (between quotes).
  const lo = str.getStart(sf) + 1
  const hi = str.getEnd() - 1
  const ident = identifierAt(sourceText, offset, lo, hi)
  if (!ident) return undefined
  if (SQL_KEYWORDS.has(ident.word.toUpperCase())) return undefined // not a column
  // A token wrapped in SQL single quotes is a string literal, not a column.
  if (sourceText[ident.start - 1] === "'" && sourceText[ident.end] === "'")
    return undefined

  return {
    kind: "column-ref",
    tag,
    prop,
    ident: ident.word,
    range: toRange(sf, ident.start, ident.end),
  }
}

// ── AST helpers ─────────────────────────────────────────────────────

type TagHolder =
  | ts.JsxOpeningElement
  | ts.JsxSelfClosingElement
  | ts.JsxClosingElement

function isTagHolder(node: ts.Node): node is TagHolder {
  return (
    ts.isJsxOpeningElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxClosingElement(node)
  )
}

function isStringLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
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

/** Render a JSX tag name, handling dot-notation (`Route.Branch`, `Query.Where`). */
function tagText(tagName: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tagName)) return tagName.text
  if (
    ts.isPropertyAccessExpression(tagName) &&
    ts.isIdentifier(tagName.expression)
  ) {
    return `${tagName.expression.text}.${tagName.name.text}`
  }
  return undefined
}

function attrName(name: ts.JsxAttributeName, sf: ts.SourceFile): string {
  return ts.isIdentifier(name) ? name.text : name.getText(sf)
}

function toRange(sf: ts.SourceFile, start: number, end: number): SourceRange {
  return {
    start: sf.getLineAndCharacterOfPosition(start),
    end: sf.getLineAndCharacterOfPosition(end),
  }
}

/**
 * The identifier word under `offset`, bounded to `[lo, hi)` (a string's content
 * between its quotes). Returns `undefined` on whitespace/operators, on a numeric
 * literal, or out of bounds. Hovering the right edge of a word still resolves it.
 */
function identifierAt(
  text: string,
  offset: number,
  lo: number,
  hi: number,
):
  | { readonly word: string; readonly start: number; readonly end: number }
  | undefined {
  const isWord = (c: string): boolean => /[A-Za-z0-9_$]/.test(c)
  if (offset < lo || offset > hi) return undefined
  let i = offset
  if (i >= hi || !isWord(text[i])) {
    if (i > lo && isWord(text[i - 1])) i -= 1
    else return undefined
  }
  let start = i
  while (start > lo && isWord(text[start - 1])) start -= 1
  let end = i
  while (end < hi && isWord(text[end])) end += 1
  const word = text.slice(start, end)
  if (!word || /^[0-9]/.test(word)) return undefined // numeric literal, not an identifier
  return { word, start, end }
}

/** SQL reserved words that may appear inside an expression prop but are never
 *  column references. Functions/aliases are not listed — those fall through and
 *  the column-ref card marks them "unknown column" on a schema miss. */
const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "IS",
  "IN",
  "LIKE",
  "BETWEEN",
  "AS",
  "ON",
  "BY",
  "GROUP",
  "ORDER",
  "HAVING",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "TRUE",
  "FALSE",
  "ASC",
  "DESC",
  "DISTINCT",
  "EXISTS",
  "ALL",
  "ANY",
  "UNION",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "INTERVAL",
  "CAST",
  "OVER",
  "PARTITION",
  "ROWS",
  "RANGE",
  "CURRENT",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "MOD",
  "DIV",
])
