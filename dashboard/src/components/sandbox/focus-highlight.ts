// ── Focus Highlighting ──────────────────────────────────────────────
// CodeMirror 6 extension that dims non-featured lines in Transform
// examples. Used by both the editor (TSX) and output viewer (SQL).

import {
  type Extension,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view"

// ---------------------------------------------------------------------------
// State effect + field
// ---------------------------------------------------------------------------

/** Dispatch with a Set of 0-based line indices to keep bright, or null to clear. */
export const setFocusLines = StateEffect.define<Set<number> | null>()

const dimDecoration = Decoration.line({ class: "cm-dim-line" })

export const focusHighlightField: Extension = (() => {
  const field = StateField.define<DecorationSet>({
    create: () => RangeSet.empty,
    update(decorations, tr) {
      for (const e of tr.effects) {
        if (e.is(setFocusLines)) {
          if (!e.value) return RangeSet.empty
          const focusSet = e.value
          const builder: { from: number }[] = []
          for (let i = 1; i <= tr.state.doc.lines; i++) {
            if (!focusSet.has(i - 1)) {
              builder.push({ from: tr.state.doc.line(i).from })
            }
          }
          return RangeSet.of(builder.map((b) => dimDecoration.range(b.from)))
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
): Set<number> {
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
        const start = i
        focused.add(i)
        i++
        while (i < lines.length) {
          focused.add(i)
          if (lines[i].includes("/>") || lines[i].includes(`</${comp}>`)) {
            // If closing tag found, but there might be nested content — check for paired close
            if (lines[i].includes(`</${comp}>`)) {
              i++
              break
            }
            // Self-closing />: only end if we haven't seen an opening > before
            // Check if the opening tag was closed with > (meaning children follow)
            const openRegion = lines.slice(start, i + 1).join("\n")
            const hasOpenClose = new RegExp(`<${comp}[^/]*>`).test(openRegion)
            if (hasOpenClose && !lines[i].includes(`</${comp}>`)) {
              // This /> is inside the tag props, keep scanning for </Comp>
              i++
              continue
            }
            i++
            break
          }
          i++
        }
      } else {
        i++
      }
    }
  }

  return focused
}

// ---------------------------------------------------------------------------
// SQL focus range computation (uses statementOrigins from synthesis)
// ---------------------------------------------------------------------------

interface StatementOrigin {
  readonly nodeId: string
  readonly component: string
  readonly kind: string
}

/**
 * Computes which SQL lines to keep bright based on statement origins.
 *
 * The synthesizer produces individual `statements[]` joined by `\n\n`.
 * `statementOrigins` maps each statement index to its source node.
 * We dim statements from Source/Sink nodes and keep statements from
 * nodes whose component name is in `focusComponents`.
 */
export function computeSqlFocusLines(
  sql: string,
  statements: readonly string[],
  statementOrigins: ReadonlyMap<number, StatementOrigin>,
  focusComponents: string[],
): Set<number> {
  const focused = new Set<number>()
  const focusSet = new Set(focusComponents)

  // Walk through statements and map each to its line range in the joined SQL.
  // Statements are joined with "\n\n", so we track the current line offset.
  let currentLine = 0
  for (let stmtIdx = 0; stmtIdx < statements.length; stmtIdx++) {
    const stmt = statements[stmtIdx]
    const stmtLineCount = stmt.split("\n").length

    const origin = statementOrigins.get(stmtIdx)
    // A statement is focused if its origin component is in focusComponents,
    // or if it has no origin (DML/INSERT INTO — contains the transform SQL)
    const isFocused =
      !origin || focusSet.has(origin.component) || origin.kind === "Transform"

    if (isFocused) {
      for (let j = 0; j < stmtLineCount; j++) {
        focused.add(currentLine + j)
      }
    }

    // Advance past statement lines + the blank line separator (\n\n)
    currentLine += stmtLineCount + 1
  }

  return focused
}
