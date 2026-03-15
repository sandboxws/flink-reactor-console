import { useCallback, useEffect, useRef } from "react"
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
  type Extension,
  RangeSet,
} from "@codemirror/state"
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  GutterMarker,
  gutter,
} from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching } from "@codemirror/language"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { gruvpuccinCmTheme } from "./themes/gruvpuccin-cm-theme"
import { tokyoNightCmTheme } from "./themes/tokyo-night-cm-theme"
import type { ValidationDiagnostic } from "@/stores/sandbox-store"

// ---------------------------------------------------------------------------
// Gutter marker classes
// ---------------------------------------------------------------------------

class ErrorMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("div")
    el.className = "cm-diagnostic-error"
    el.style.width = "6px"
    el.style.height = "6px"
    el.style.borderRadius = "50%"
    el.style.backgroundColor = "#ef4444"
    el.style.margin = "4px 2px"
    return el
  }
}

class WarningMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("div")
    el.className = "cm-diagnostic-warning"
    el.style.width = "0"
    el.style.height = "0"
    el.style.borderLeft = "3px solid transparent"
    el.style.borderRight = "3px solid transparent"
    el.style.borderBottom = "6px solid #f59e0b"
    el.style.margin = "4px 2px"
    return el
  }
}

const errorMarker = new ErrorMarker()
const warningMarker = new WarningMarker()

// ---------------------------------------------------------------------------
// Diagnostic gutter state
// ---------------------------------------------------------------------------

type DiagnosticMarkerEntry = { from: number; marker: GutterMarker }

const setDiagnosticMarkers = StateEffect.define<DiagnosticMarkerEntry[]>()

const diagnosticMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    for (const e of tr.effects) {
      if (e.is(setDiagnosticMarkers)) {
        const sorted = e.value.sort((a, b) => a.from - b.from)
        return RangeSet.of(sorted.map((m) => m.marker.range(m.from)))
      }
    }
    return markers
  },
})

const diagnosticGutter = gutter({
  class: "cm-diagnostic-gutter",
  markers: (view) => view.state.field(diagnosticMarkersField),
})

// ---------------------------------------------------------------------------
// Map diagnostics to source lines via component name matching
// ---------------------------------------------------------------------------

function mapDiagnosticsToLines(
  doc: string,
  diagnostics: ValidationDiagnostic[],
): DiagnosticMarkerEntry[] {
  const entries: DiagnosticMarkerEntry[] = []
  const lines = doc.split("\n")
  const usedLines = new Set<number>()

  for (const d of diagnostics) {
    const compName = d.componentName
    if (!compName) continue

    // Find the first line containing this component name as a JSX tag or function call
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      const line = lines[i]
      if (
        line.includes(`<${compName}`) ||
        line.includes(`${compName}(`) ||
        line.includes(`${compName} `)
      ) {
        // Calculate character offset for the start of this line
        let offset = 0
        for (let j = 0; j < i; j++) {
          offset += lines[j].length + 1 // +1 for newline
        }
        entries.push({
          from: offset,
          marker: d.severity === "error" ? errorMarker : warningMarker,
        })
        usedLines.add(i)
        break
      }
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

interface SandboxEditorProps {
  value: string
  onChange: (value: string) => void
  onSynthesize: () => void
  diagnostics?: ValidationDiagnostic[]
}

const themeCompartment = new Compartment()

function getActiveTheme() {
  if (typeof document === "undefined") return tokyoNightCmTheme
  return document.documentElement.dataset.palette === "gruvpuccin"
    ? gruvpuccinCmTheme
    : tokyoNightCmTheme
}

export function SandboxEditor({ value, onChange, onSynthesize, diagnostics = [] }: SandboxEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  const onSynthesizeRef = useRef(onSynthesize)

  onChangeRef.current = onChange
  onSynthesizeRef.current = onSynthesize

  const debouncedSynthesize = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSynthesizeRef.current()
    }, 300)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        javascript({ jsx: true, typescript: true }),
        diagnosticMarkersField,
        diagnosticGutter,
        themeCompartment.of(getActiveTheme()),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              onSynthesizeRef.current()
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const doc = update.state.doc.toString()
            onChangeRef.current(doc)
            debouncedSynthesize()
          }
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (e.g. example loaded from sidebar)
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

  // Update gutter markers when diagnostics change
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc.toString()
    const entries = mapDiagnosticsToLines(doc, diagnostics)
    view.dispatch({ effects: setDiagnosticMarkers.of(entries) })
  }, [diagnostics])

  // Watch for palette changes and reconfigure the theme compartment
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: themeCompartment.reconfigure(getActiveTheme()),
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-palette"],
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-diagnostic-gutter]:w-[12px]"
    />
  )
}
