// The LSP semantic-tokens provider for embedded Flink SQL (embedded-sql-
// highlighting, Tier-2). It finds every SQL fragment in a pipeline `.tsx`
// (`findSqlContexts`), tokenizes each against the known vocabulary
// (`tokenizeSql`), and encodes the result as `textDocument/semanticTokens`
// data — the precise, synthesis-aware layer that VS Code renders *over* the
// TextMate injection grammar.
//
// Key properties (tasks 5.1–5.5):
//   • Synthesis-independent: ranges come from the parsed AST, so tokens are
//     emitted even when `synthesizeApp()` fails or the SQL does not parse.
//   • Best-effort: never throws; on a transient recompute failure it returns the
//     *prior* token set rather than blanking already-shown coloring.
//   • Cached per document version: repeated full/range requests for an unchanged
//     document reuse one computation; only the identified SQL ranges are walked,
//     not the whole document.
//   • Editor-agnostic: pure LSP types, so any client (VS Code, IntelliJ LSP,
//     Neovim) receives the same tokens.

import ts from "typescript"
import type {
  SemanticTokens,
  SemanticTokensLegend,
} from "vscode-languageserver"
import {
  SQL_CONTEXT_KINDS,
  type SqlContextKind,
} from "../sql/context-registry.js"
import { findSqlContexts } from "../sql/find-contexts.js"
import { tokenizeSql } from "../sql/tokenizer.js"
import type { SqlTokenCategory } from "../sql/vocabulary.js"

// ── Legend ───────────────────────────────────────────────────────────────
// Standard LSP semantic-token *types* (so any theme colors them with no config)
// in a fixed index order, plus FR-specific *modifiers* — one per SQL context
// kind, letting a theme optionally distinguish a join `on` from a projection.

/** The seven token types, indexed by position. Matches `SqlTokenCategory`. */
export const SQL_TOKEN_TYPES: readonly SqlTokenCategory[] = [
  "keyword",
  "function",
  "operator",
  "type",
  "number",
  "string",
  "comment",
]

/** Token modifiers: the SQL context kinds, indexed by position (one bit each). */
export const SQL_TOKEN_MODIFIERS: readonly SqlContextKind[] = SQL_CONTEXT_KINDS

/** The legend advertised in `initialize` and shared with the dispatcher. */
export const SQL_SEMANTIC_LEGEND: SemanticTokensLegend = {
  tokenTypes: [...SQL_TOKEN_TYPES],
  tokenModifiers: [...SQL_TOKEN_MODIFIERS],
}

const TYPE_INDEX: Record<SqlTokenCategory, number> = Object.fromEntries(
  SQL_TOKEN_TYPES.map((t, i) => [t, i]),
) as Record<SqlTokenCategory, number>

const MODIFIER_BIT: Record<SqlContextKind, number> = Object.fromEntries(
  SQL_TOKEN_MODIFIERS.map((k, i) => [k, 1 << i]),
) as Record<SqlContextKind, number>

// ── Provider ───────────────────────────────────────────────────────────────

/** A positioned token before delta-encoding (one source line each). */
interface RawToken {
  readonly line: number
  readonly char: number
  readonly length: number
  readonly typeIndex: number
  readonly modifierBits: number
}

const EMPTY: SemanticTokens = { data: [] }

/**
 * Computes and caches SQL semantic tokens per document version. One instance is
 * held by the server and shared by the `full` and `range` endpoints.
 */
export class SqlSemanticTokensProvider {
  private readonly cache = new Map<
    string,
    { version: number; raw: RawToken[] }
  >()

  /** Full-document semantic tokens, or empty when SQL semantic coloring is off
   *  for this client (`textmate`/`off`). */
  full(input: TokenInput): SemanticTokens {
    if (!input.enabled) return EMPTY
    const raw = this.rawFor(input)
    return { data: encode(raw) }
  }

  /** Tokens intersecting `[startLine, endLine]` (a `semanticTokens/range`
   *  request) — the same cached computation, filtered by line. */
  range(input: TokenInput, startLine: number, endLine: number): SemanticTokens {
    if (!input.enabled) return EMPTY
    const raw = this.rawFor(input).filter(
      (t) => t.line >= startLine && t.line <= endLine,
    )
    return { data: encode(raw) }
  }

  /** Drop a document's cached tokens (on close). */
  forget(uri: string): void {
    this.cache.delete(uri)
  }

  /** Return the cached raw tokens for this version, else recompute. On a
   *  recompute throw, fall back to the prior cached set (never blank). */
  private rawFor(input: TokenInput): RawToken[] {
    const cached = this.cache.get(input.uri)
    if (cached && cached.version === input.version) return cached.raw
    try {
      const raw = computeRawTokens(input.sourceText, input.fileName)
      this.cache.set(input.uri, { version: input.version, raw })
      return raw
    } catch {
      // Transient failure: keep showing the last good tokens rather than
      // blanking coloring mid-keystroke (spec: "never blanking on a transient
      // failure"). Empty only when we have nothing cached yet.
      return cached?.raw ?? []
    }
  }
}

export interface TokenInput {
  readonly uri: string
  readonly version: number
  readonly sourceText: string
  /** Filesystem path for the TSX parse (script-kind detection). */
  readonly fileName: string
  /** False when the client's `flinkReactor.sql.highlighting` excludes the
   *  semantic layer (`textmate`/`off`) — then no SQL tokens are emitted. */
  readonly enabled: boolean
}

/** Parse, find SQL fragments, tokenize each, and project to positioned tokens. */
function computeRawTokens(sourceText: string, fileName: string): RawToken[] {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )
  const tokens: RawToken[] = []
  for (const context of findSqlContexts(sf, sourceText)) {
    const modifierBits = MODIFIER_BIT[context.kind]
    for (const tok of tokenizeSql(context.text)) {
      pushPositioned(
        tokens,
        context.startOffset + tok.offset,
        tok.length,
        TYPE_INDEX[tok.category],
        modifierBits,
        sf,
        sourceText,
      )
    }
  }
  // Encoding requires ascending (line, char) order; the source walk is already
  // close to sorted, but sort to be robust against nested/out-of-order shapes.
  tokens.sort((a, b) => a.line - b.line || a.char - b.char)
  return tokens
}

/**
 * Append a token, splitting it per source line. LSP semantic tokens may not span
 * lines, so a multi-line string/comment becomes one token per line it covers.
 */
function pushPositioned(
  out: RawToken[],
  absStart: number,
  length: number,
  typeIndex: number,
  modifierBits: number,
  sf: ts.SourceFile,
  sourceText: string,
): void {
  const text = sourceText.slice(absStart, absStart + length)
  let cursor = 0
  for (const line of text.split("\n")) {
    const segment = line.endsWith("\r") ? line.slice(0, -1) : line
    if (segment.length > 0) {
      const lc = sf.getLineAndCharacterOfPosition(absStart + cursor)
      out.push({
        line: lc.line,
        char: lc.character,
        length: segment.length,
        typeIndex,
        modifierBits,
      })
    }
    cursor += line.length + 1 // + the "\n" consumed by split
  }
}

/** Delta-encode positioned tokens into the LSP `data` array. */
function encode(tokens: readonly RawToken[]): number[] {
  const data: number[] = []
  let prevLine = 0
  let prevChar = 0
  for (const t of tokens) {
    const deltaLine = t.line - prevLine
    const deltaChar = deltaLine === 0 ? t.char - prevChar : t.char
    data.push(deltaLine, deltaChar, t.length, t.typeIndex, t.modifierBits)
    prevLine = t.line
    prevChar = t.char
  }
  return data
}
