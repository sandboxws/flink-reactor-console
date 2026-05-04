/**
 * @module sql-code-viewer
 *
 * Read-only CodeMirror 6 viewer with `@codemirror/lang-sql` syntax highlighting.
 * Composes the read-only setup from `synthesis-output.tsx:CodeViewer` with the
 * SQL language extension from `explore-editor.tsx`. Theme reactivity uses the
 * shared `cm-themes` palette observer.
 */

import { sql } from "@codemirror/lang-sql"
import {
  bracketMatching,
  codeFolding,
  foldGutter,
} from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { EditorView, lineNumbers, placeholder } from "@codemirror/view"
import { useEffect, useRef } from "react"
import {
  createThemeCompartment,
  getActiveTheme,
  useCmPaletteObserver,
} from "@/lib/cm-themes"
import { cn } from "@/lib/cn"

const themeCompartment = createThemeCompartment()

export interface SqlCodeViewerProps {
  value: string
  className?: string
  placeholder?: string
}

export function SqlCodeViewer({
  value,
  className,
  placeholder: placeholderText,
}: SqlCodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Mount the editor once.
  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      lineNumbers(),
      bracketMatching(),
      sql(),
      codeFolding({ placeholderText: "…" }),
      foldGutter({ openText: "▾", closedText: "▸" }),
      themeCompartment.of(getActiveTheme()),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ]
    if (placeholderText) {
      extensions.push(placeholder(placeholderText))
    }

    const state = EditorState.create({ doc: "", extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes via a single transaction.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  // Watch for palette changes and reconfigure the theme compartment.
  useCmPaletteObserver(viewRef, themeCompartment)

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-editor]:outline-none",
        className,
      )}
    />
  )
}
