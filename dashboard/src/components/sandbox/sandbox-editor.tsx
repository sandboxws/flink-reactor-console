import { autocompletion, completionKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching } from "@codemirror/language"
import {
  Compartment,
  EditorState,
  RangeSet,
  StateEffect,
  StateField,
} from "@codemirror/state"
import {
  EditorView,
  GutterMarker,
  gutter,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { useCallback, useEffect, useRef } from "react"
import type { ValidationDiagnostic } from "@/stores/sandbox-store"
import { dslCompletionSource } from "./completions"
import {
  computeTsxFocusLines,
  focusHighlightField,
  setFocusLines,
} from "./focus-highlight"
import { gruvpuccinCmTheme } from "./themes/gruvpuccin-cm-theme"
import { tokyoNightCmTheme } from "./themes/tokyo-night-cm-theme"

// ---------------------------------------------------------------------------
// Gutter marker classes — each instance carries its diagnostic message
// ---------------------------------------------------------------------------

class DiagnosticGutterMarker extends GutterMarker {
  constructor(
    readonly severity: "error" | "warning",
    readonly messages: string[],
  ) {
    super()
  }

  toDOM() {
    const el = document.createElement("div")
    el.style.margin = "4px 2px"
    el.style.cursor = "default"

    if (this.severity === "error") {
      el.className = "cm-diagnostic-error"
      el.style.width = "6px"
      el.style.height = "6px"
      el.style.borderRadius = "50%"
      el.style.backgroundColor = "#ef4444"
    } else {
      el.className = "cm-diagnostic-warning"
      el.style.width = "0"
      el.style.height = "0"
      el.style.borderLeft = "3px solid transparent"
      el.style.borderRight = "3px solid transparent"
      el.style.borderBottom = "6px solid #f59e0b"
    }

    return el
  }
}

// ---------------------------------------------------------------------------
// Hover tooltip — plain DOM element positioned near the gutter
// ---------------------------------------------------------------------------

let tooltipEl: HTMLDivElement | null = null

function showTooltip(
  messages: string[],
  severity: "error" | "warning",
  anchor: HTMLElement,
) {
  hideTooltip()

  tooltipEl = document.createElement("div")
  tooltipEl.className = "cm-diagnostic-tooltip"

  const borderColor =
    severity === "error" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"
  const bgColor =
    severity === "error" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)"
  const textColor = severity === "error" ? "#fca5a5" : "#fcd34d"

  Object.assign(tooltipEl.style, {
    position: "fixed",
    zIndex: "1000",
    maxWidth: "420px",
    padding: "6px 10px",
    borderRadius: "6px",
    border: `1px solid ${borderColor}`,
    backgroundColor: bgColor,
    backdropFilter: "blur(8px)",
    color: textColor,
    fontSize: "11px",
    lineHeight: "1.5",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  })

  tooltipEl.textContent = messages.join("\n")

  document.body.appendChild(tooltipEl)

  // Position to the right of the gutter marker
  const rect = anchor.getBoundingClientRect()
  tooltipEl.style.left = `${rect.right + 8}px`
  tooltipEl.style.top = `${rect.top - 4}px`
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.remove()
    tooltipEl = null
  }
}

// ---------------------------------------------------------------------------
// Diagnostic gutter state
// ---------------------------------------------------------------------------

type DiagnosticMarkerEntry = { from: number; marker: DiagnosticGutterMarker }

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
  domEventHandlers: {
    mouseover(view, line, event) {
      const target = event.target as HTMLElement
      const markerEl = target.closest(
        ".cm-diagnostic-error, .cm-diagnostic-warning",
      )
      if (!markerEl) return false

      // Find the marker for this line
      const markers = view.state.field(diagnosticMarkersField)
      const lineFrom = line.from
      let found: DiagnosticGutterMarker | null = null
      const cursor = markers.iter(lineFrom)
      if (
        cursor.value &&
        cursor.from === lineFrom &&
        cursor.value instanceof DiagnosticGutterMarker
      ) {
        found = cursor.value
      }

      if (found) {
        showTooltip(found.messages, found.severity, markerEl as HTMLElement)
      }
      return false
    },
    mouseout() {
      hideTooltip()
      return false
    },
  },
})

// ---------------------------------------------------------------------------
// Map diagnostics to source lines via component name matching
// ---------------------------------------------------------------------------

interface LineDiagnostic {
  offset: number
  severity: "error" | "warning"
  messages: string[]
}

function mapDiagnosticsToLines(
  doc: string,
  diagnostics: ValidationDiagnostic[],
): DiagnosticMarkerEntry[] {
  const lines = doc.split("\n")
  // Collect all diagnostics per line
  const lineMap = new Map<number, LineDiagnostic>()

  for (const d of diagnostics) {
    const compName = d.componentName
    if (!compName) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (
        line.includes(`<${compName}`) ||
        line.includes(`${compName}(`) ||
        line.includes(`${compName} `)
      ) {
        const existing = lineMap.get(i)
        if (existing) {
          existing.messages.push(d.message)
          // Promote to error if any diagnostic on this line is an error
          if (d.severity === "error") existing.severity = "error"
        } else {
          let offset = 0
          for (let j = 0; j < i; j++) {
            offset += lines[j].length + 1
          }
          lineMap.set(i, {
            offset,
            severity: d.severity,
            messages: [d.message],
          })
        }
        break
      }
    }
  }

  return Array.from(lineMap.values()).map((ld) => ({
    from: ld.offset,
    marker: new DiagnosticGutterMarker(ld.severity, ld.messages),
  }))
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

interface SandboxEditorProps {
  value: string
  onChange: (value: string) => void
  onSynthesize: () => void
  diagnostics?: ValidationDiagnostic[]
  focusComponents?: string[] | null
}

const themeCompartment = new Compartment()

function getActiveTheme() {
  if (typeof document === "undefined") return tokyoNightCmTheme
  return document.documentElement.dataset.palette === "gruvpuccin"
    ? gruvpuccinCmTheme
    : tokyoNightCmTheme
}

export function SandboxEditor({
  value,
  onChange,
  onSynthesize,
  diagnostics = [],
  focusComponents,
}: SandboxEditorProps) {
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
        autocompletion({
          override: [dslCompletionSource],
          activateOnTyping: true,
          icons: true,
        }),
        diagnosticMarkersField,
        diagnosticGutter,
        focusHighlightField,
        themeCompartment.of(getActiveTheme()),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
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
      hideTooltip()
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
    hideTooltip()
    const doc = view.state.doc.toString()
    const entries = mapDiagnosticsToLines(doc, diagnostics)
    view.dispatch({ effects: setDiagnosticMarkers.of(entries) })
  }, [diagnostics])

  // Update focus highlighting when focusComponents change
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (!focusComponents || focusComponents.length === 0) {
      view.dispatch({ effects: setFocusLines.of(null) })
      return
    }
    const doc = view.state.doc.toString()
    const lines = computeTsxFocusLines(doc, focusComponents)
    view.dispatch({ effects: setFocusLines.of(lines) })
  }, [focusComponents])

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
