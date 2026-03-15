import { useCallback, useEffect, useRef } from "react"
import { EditorState, Compartment } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching } from "@codemirror/language"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { gruvpuccinCmTheme } from "./themes/gruvpuccin-cm-theme"
import { tokyoNightCmTheme } from "./themes/tokyo-night-cm-theme"

interface SandboxEditorProps {
  value: string
  onChange: (value: string) => void
  onSynthesize: () => void
}

const themeCompartment = new Compartment()

function getActiveTheme() {
  if (typeof document === "undefined") return tokyoNightCmTheme
  return document.documentElement.dataset.palette === "gruvpuccin"
    ? gruvpuccinCmTheme
    : tokyoNightCmTheme
}

export function SandboxEditor({ value, onChange, onSynthesize }: SandboxEditorProps) {
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
      className="h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
    />
  )
}
