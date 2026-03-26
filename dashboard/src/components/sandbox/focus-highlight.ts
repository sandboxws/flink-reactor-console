/**
 * CodeMirror 6 extension that dims non-featured lines in Transform
 * examples. Used by both the TSX editor and the SQL output viewer to
 * highlight focused components while dimming surrounding context.
 */

import {
  type Extension,
  type Range,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view"

// ---------------------------------------------------------------------------
// State effect + field
// ---------------------------------------------------------------------------

/** Focus data: lines to fully dim + character spans to dim within partially-focused lines. */
export interface FocusData {
  /** 0-based line indices to dim entirely (line-level). */
  dimLines: Set<number>
  /** Absolute document positions of dim spans within partially-focused lines. */
  dimSpans: Array<{ from: number; to: number }>
  /** 0-based line indices that are SQL comments (section headers, annotations). */
  commentLines: Set<number>
}

/** Dispatch with FocusData to apply focus highlighting, or null to clear. */
export const setFocusLines = StateEffect.define<FocusData | null>()

/** Line decoration applied to fully dimmed (unfocused) lines. */
const dimLineDecoration = Decoration.line({ class: "cm-dim-line" })
/** Mark decoration applied to dim character spans within partially-focused lines. */
const dimMarkDecoration = Decoration.mark({ class: "cm-dim-span" })
/** Line decoration applied to SQL comment lines (section headers). */
const commentLineDecoration = Decoration.line({ class: "cm-sql-comment" })

/**
 * Bundled CodeMirror extension that manages focus-highlight decorations.
 * Reacts to {@link setFocusLines} effects to apply line-level and
 * character-level dimming.
 */
export const focusHighlightField: Extension = (() => {
  const field = StateField.define<DecorationSet>({
    create: () => RangeSet.empty,
    update(decorations, tr) {
      for (const e of tr.effects) {
        if (e.is(setFocusLines)) {
          if (!e.value) return RangeSet.empty
          const { dimLines, dimSpans, commentLines } = e.value
          const ranges: Range<Decoration>[] = []

          // Line decorations for fully dimmed lines and comment lines
          for (let i = 1; i <= tr.state.doc.lines; i++) {
            const lineIdx = i - 1
            if (dimLines.has(lineIdx)) {
              ranges.push(dimLineDecoration.range(tr.state.doc.line(i).from))
            } else if (commentLines.has(lineIdx)) {
              ranges.push(
                commentLineDecoration.range(tr.state.doc.line(i).from),
              )
            }
          }

          // Mark decorations for character-level dim spans
          for (const span of dimSpans) {
            if (span.from < span.to && span.to <= tr.state.doc.length) {
              ranges.push(dimMarkDecoration.range(span.from, span.to))
            }
          }

          // RangeSet requires sorted ranges
          ranges.sort(
            (a, b) => a.from - b.from || a.value.startSide - b.value.startSide,
          )
          return RangeSet.of(ranges)
        }
      }
      return decorations
    },
  })

  return [field, EditorView.decorations.from(field)]
})()

// ---------------------------------------------------------------------------
// TSX focus range computation
// ---------------------------------------------------------------------------

/**
 * Finds 0-based line indices belonging to the given JSX component tags.
 * Handles self-closing (`<Foo ... />`) and paired (`<Foo>...</Foo>`) tags,
 * including multi-line props.
 */
export function computeTsxFocusLines(
  code: string,
  focusComponents: string[],
): FocusData {
  const lines = code.split("\n")
  const focused = new Set<number>()

  for (const comp of focusComponents) {
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      // Match opening tag: <ComponentName or <ComponentName> or <ComponentName ...
      if (new RegExp(`<${comp}(\\s|>|$|/)`).test(line)) {
        // Self-closing on this line?
        if (line.includes("/>")) {
          focused.add(i)
          i++
          continue
        }
        // Check for closing tag on same line
        if (line.includes(`</${comp}>`)) {
          focused.add(i)
          i++
          continue
        }
        // Multi-line: scan forward for self-close or closing tag
        const openIndent = line.search(/\S/)
        focused.add(i)
        i++
        while (i < lines.length) {
          focused.add(i)
          if (lines[i].includes(`</${comp}>`)) {
            i++
            break
          }
          if (lines[i].includes("/>")) {
            // Use indentation to distinguish this component's self-close
            // from a child element's self-close. The closing /> of the
            // current component will be at the same (or lesser) indent.
            const closeIndent = lines[i].search(/\S/)
            if (closeIndent <= openIndent) {
              i++
              break
            }
          }
          i++
        }
      } else {
        i++
      }
    }
  }

  // Convert focused lines to dimLines (inverse)
  const dimLines = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    if (!focused.has(i)) dimLines.add(i)
  }

  return { dimLines, dimSpans: [], commentLines: new Set() }
}

// ---------------------------------------------------------------------------
// SQL focus range computation (uses statementOrigins from synthesis)
// ---------------------------------------------------------------------------

/** Provenance of a synthesized SQL statement (which DSL component produced it). */
interface StatementOrigin {
  readonly nodeId: string
  readonly component: string
  readonly kind: string
}

/** A character range within a SQL statement traced back to a specific DSL component. */
interface SqlFragment {
  /** Byte offset within the containing statement. */
  readonly offset: number
  /** Length in bytes of this fragment. */
  readonly length: number
  /** The DSL component that produced this fragment. */
  readonly origin: StatementOrigin
}

/**
 * Computes focus highlighting for SQL output.
 *
 * For DDL statements (CREATE TABLE, SET, etc.), uses line-level dimming.
 * For DML statements with fragment contributors, uses character-level
 * dimming: bright spans stay untouched while non-focused characters
 * within the same line get dimmed via mark decorations. This avoids
 * the CSS opacity inheritance issue where children can't override
 * a parent's opacity.
 */
export function computeSqlFocusLines(
  sql: string,
  statements: readonly string[],
  statementOrigins: ReadonlyMap<number, StatementOrigin>,
  statementContributors: ReadonlyMap<number, readonly SqlFragment[]>,
  focusComponents: string[],
  commentIndices?: ReadonlySet<number>,
): FocusData {
  const dimLines = new Set<number>()
  const dimSpans: Array<{ from: number; to: number }> = []
  const commentLines = new Set<number>()
  const focusSet = new Set(focusComponents)

  // Walk through statements tracking both line indices and document offsets.
  // Statements are joined with "\n\n", so between each pair there are 2 chars.
  let currentLine = 0
  let docOffset = 0

  for (let stmtIdx = 0; stmtIdx < statements.length; stmtIdx++) {
    const stmt = statements[stmtIdx]
    const stmtLines = stmt.split("\n")

    const contributors = statementContributors.get(stmtIdx)
    if (contributors && contributors.length > 0) {
      // ── Character-level focus ──
      // Collect focused byte ranges within the statement
      const brightRanges: Array<{ from: number; to: number }> = []
      for (const f of contributors) {
        if (focusSet.has(f.origin.component)) {
          brightRanges.push({ from: f.offset, to: f.offset + f.length })
        }
      }

      // Merge bright ranges that are close together (gap ≤ 2 chars, e.g. ", ")
      // so that separators between adjacent focused columns stay bright.
      const merged = mergeBrightRanges(brightRanges, 2)

      // For each line, compute dim spans (non-bright parts)
      let lineByteStart = 0
      for (let lineIdx = 0; lineIdx < stmtLines.length; lineIdx++) {
        const lineLen = stmtLines[lineIdx].length
        const lineByteEnd = lineByteStart + lineLen
        const lineDocStart = docOffset + lineByteStart

        // Find bright ranges overlapping this line, clipped to line bounds
        const lineBrights: Array<{ from: number; to: number }> = []
        for (const br of merged) {
          if (br.from < lineByteEnd && br.to > lineByteStart) {
            lineBrights.push({
              from: Math.max(br.from, lineByteStart) - lineByteStart,
              to: Math.min(br.to, lineByteEnd) - lineByteStart,
            })
          }
        }

        if (lineBrights.length === 0) {
          // No bright ranges on this line → dim the whole line
          dimLines.add(currentLine + lineIdx)
        } else {
          // Compute dim spans as the inverse of bright spans on this line
          lineBrights.sort((a, b) => a.from - b.from)
          let cursor = 0
          for (const br of lineBrights) {
            if (br.from > cursor) {
              dimSpans.push({
                from: lineDocStart + cursor,
                to: lineDocStart + br.from,
              })
            }
            cursor = br.to
          }
          // Trailing dim span
          if (cursor < lineLen) {
            dimSpans.push({
              from: lineDocStart + cursor,
              to: lineDocStart + lineLen,
            })
          }
        }

        lineByteStart = lineByteEnd + 1 // +1 for the \n
      }
    } else if (commentIndices?.has(stmtIdx)) {
      // ── Comment statement (section header or annotation) ──
      // Always dim comment lines during focus mode
      for (let j = 0; j < stmtLines.length; j++) {
        dimLines.add(currentLine + j)
      }
    } else {
      // ── Line-level focus (DDL, SET, etc.) ──
      const origin = statementOrigins.get(stmtIdx)
      const isFocused = origin
        ? focusSet.has(origin.component) || origin.kind === "Transform"
        : false

      if (!isFocused) {
        for (let j = 0; j < stmtLines.length; j++) {
          dimLines.add(currentLine + j)
        }
      }
    }

    // Advance past statement lines + the blank line separator (\n\n)
    currentLine += stmtLines.length + 1
    docOffset += stmt.length + 2 // +2 for "\n\n" separator
  }

  // Track comment lines for styling when no focus is active
  if (commentIndices) {
    let cl = 0
    let co = 0
    for (let si = 0; si < statements.length; si++) {
      const s = statements[si]
      const sLines = s.split("\n")
      if (commentIndices.has(si)) {
        for (let j = 0; j < sLines.length; j++) {
          commentLines.add(cl + j)
        }
      }
      cl += sLines.length + 1
      co += s.length + 2
    }
  }

  return { dimLines, dimSpans, commentLines }
}

/**
 * Merge bright ranges that are separated by at most `threshold` characters.
 * This keeps small gaps (like ", " between columns) bright rather than
 * creating jarring dim/bright/dim patterns.
 */
function mergeBrightRanges(
  ranges: Array<{ from: number; to: number }>,
  threshold: number,
): Array<{ from: number; to: number }> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.from - b.from)
  const merged: Array<{ from: number; to: number }> = [{ ...sorted[0] }]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur.from <= last.to + threshold) {
      // Merge: extend the last range
      last.to = Math.max(last.to, cur.to)
    } else {
      merged.push({ ...cur })
    }
  }

  return merged
}
