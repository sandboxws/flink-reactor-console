// The central literal/resolvable-target gate every refactoring shares
// (component-refactoring, Tier-3 feature 14).
//
// The uniform precondition: an edit may touch only what the AST resolves to a
// *literal* — a string field key, a backtick/bare token inside a string-literal
// prop, a literal attribute value. Computed expressions (`condition={expr}`),
// spread props (`{...props}`), and anything else the parser cannot pin down are
// non-actionable: rename surfaces no rewrite and code actions are not offered.
// Refusing is correct behavior, not a failure (design: "refuse rather than
// guess on non-literal targets").
//
// Also home to the SQL column-reference scanner used by both schema rename and
// the replace-with-candidate fix: it mirrors `validateSchemaReferences`'
// lexical rules (skip `'…'` strings and comments, skip vocabulary words, match
// back-quoted and bare identifiers) so an edit set covers exactly the tokens
// the validator would flag if left behind.

import ts from "typescript"
import type { TextEdit } from "vscode-languageserver"
import { classifyWord } from "../sql/vocabulary.js"

export type OpeningTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement

/** An absolute-offset edit, converted to an LSP `TextEdit` per source file at
 *  the boundary (so cross-file edits each convert against their own module). */
export interface OffsetEdit {
  readonly start: number
  readonly end: number
  readonly newText: string
}

/** Convert offset edits to LSP `TextEdit`s against `sf`'s line map, deduped
 *  (two slots can resolve to the same token) and sorted by position. */
export function toTextEdits(
  sf: ts.SourceFile,
  edits: readonly OffsetEdit[],
): TextEdit[] {
  const seen = new Set<string>()
  const unique = edits.filter((e) => {
    const key = `${e.start}:${e.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique
    .sort((a, b) => a.start - b.start)
    .map((e) => ({
      range: {
        start: sf.getLineAndCharacterOfPosition(e.start),
        end: sf.getLineAndCharacterOfPosition(e.end),
      },
      newText: e.newText,
    }))
}

/** True when the element carries a spread attribute (`{...props}`) — then no
 *  literal attribute can be safely inserted or rewritten (the spread may
 *  already supply or override it). */
export function hasSpreadProps(el: OpeningTag): boolean {
  return el.attributes.properties.some(ts.isJsxSpreadAttribute)
}

/** A JSX attribute whose value resolved to a string literal. `innerStart`/
 *  `innerEnd` bound the string *content* (inside the quotes). */
export interface LiteralAttr {
  readonly attr: ts.JsxAttribute
  readonly name: string
  readonly nameStart: number
  readonly nameEnd: number
  readonly text: string
  readonly innerStart: number
  readonly innerEnd: number
}

/** The element's attributes with string-literal values (`="x"` or `={"x"}`),
 *  resolved to their content spans. Computed/spread attributes are absent —
 *  the literal-only safety boundary. */
export function literalAttrs(el: OpeningTag, sf: ts.SourceFile): LiteralAttr[] {
  const out: LiteralAttr[] = []
  for (const prop of el.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : prop.name.getText(sf)
    const literal = attrStringLiteral(prop)
    if (!literal) continue
    out.push({
      attr: prop,
      name,
      nameStart: prop.name.getStart(sf),
      nameEnd: prop.name.getEnd(),
      text: literal.text,
      innerStart: literal.getStart(sf) + 1,
      innerEnd: literal.getEnd() - 1,
    })
  }
  return out
}

/** The string literal carried by an attribute initializer, or `undefined` for
 *  boolean/computed/spread shapes. */
export function attrStringLiteral(
  attr: ts.JsxAttribute,
): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined {
  const init = attr.initializer
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init
  if (ts.isJsxExpression(init) && init.expression) {
    if (
      ts.isStringLiteral(init.expression) ||
      ts.isNoSubstitutionTemplateLiteral(init.expression)
    ) {
      return init.expression
    }
  }
  return undefined
}

/** Offset where a new literal attribute can be inserted: right after the last
 *  attribute (or the tag name when there are none), before the closing
 *  `>`/`/>`. The caller prefixes the inserted text with a space. */
export function attrInsertionOffset(el: OpeningTag): number {
  const props = el.attributes.properties
  if (props.length > 0) return props[props.length - 1].getEnd()
  return el.tagName.getEnd()
}

/** A renamable SQL/DSL identifier: what `toSqlIdentifier` round-trips and the
 *  backtick-quoting codegen emits verbatim. */
export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

// ── SQL column-reference scanning ────────────────────────────────────

/** One column-reference token inside a verbatim-SQL fragment. `start`/`length`
 *  cover the identifier text only (never the backticks), relative to the
 *  fragment's first character. */
export interface SqlColumnRef {
  readonly start: number
  readonly length: number
  readonly name: string
  readonly backtick: boolean
}

const isDigit = (c: string): boolean => c >= "0" && c <= "9"
const isIdentStart = (c: string): boolean =>
  (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_"
const isIdentPart = (c: string): boolean => isIdentStart(c) || isDigit(c)

/**
 * Scan a verbatim-SQL fragment for column-reference tokens: back-quoted
 * identifiers and bare identifiers that are neither vocabulary words
 * (keyword/function/type), function calls (followed by `(`), nor members of a
 * dotted chain (`alias.col` / `col.member` — qualified references are
 * ambiguous between an alias qualifier and a ROW-field access, so the scanner
 * refuses them rather than guessing; the literal-only safety contract).
 * Mirrors the tokenizer's string/comment skipping so a column name inside a
 * `'string'` or `-- comment` is never treated as a reference.
 */
export function findSqlColumnRefs(sql: string): SqlColumnRef[] {
  const refs: SqlColumnRef[] = []
  const n = sql.length
  let i = 0

  while (i < n) {
    const c = sql[i]

    // Line comment `-- …` → end of line.
    if (c === "-" && sql[i + 1] === "-") {
      i += 2
      while (i < n && sql[i] !== "\n" && sql[i] !== "\r") i++
      continue
    }
    // Block comment `/* … */` (unterminated → to end).
    if (c === "/" && sql[i + 1] === "*") {
      i += 2
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i = i < n ? i + 2 : n
      continue
    }
    // Single-quoted string with `''` escape (unterminated → to end).
    if (c === "'") {
      i++
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    // Back-quoted identifier — always a column reference.
    if (c === "`") {
      const start = i + 1
      let j = start
      while (j < n && sql[j] !== "`") j++
      if (j < n && j > start) {
        const name = sql.slice(start, j)
        // A dotted chain around the quoted token is still a qualified
        // reference — refuse those like the bare case.
        const before = start - 2 >= 0 ? sql[start - 2] : ""
        const after = j + 1 < n ? sql[j + 1] : ""
        if (before !== "." && after !== ".") {
          refs.push({ start, length: name.length, name, backtick: true })
        }
        i = j + 1
        continue
      }
      i = j < n ? j + 1 : n // unterminated back-quote → skip the rest
      continue
    }
    // Bare identifier run.
    if (isIdentStart(c)) {
      const start = i
      while (i < n && isIdentPart(sql[i])) i++
      const name = sql.slice(start, i)
      // Skip whitespace to find the next significant character (call check).
      let k = i
      while (k < n && (sql[k] === " " || sql[k] === "\t")) k++
      const isCall = sql[k] === "("
      const prev = start > 0 ? sql[start - 1] : ""
      const isDotted = prev === "." || sql[i] === "."
      if (!isCall && !isDotted && classifyWord(name) === null) {
        refs.push({ start, length: name.length, name, backtick: false })
      }
      continue
    }
    i++
  }

  return refs
}
