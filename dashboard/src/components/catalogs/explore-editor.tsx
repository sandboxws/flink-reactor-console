/**
 * @module explore-editor
 *
 * CodeMirror 6 SQL editor with run/cancel controls for the catalog explore page.
 * Reads SQL text and execution status from {@link useCatalogExploreStore}.
 * Supports Cmd+Enter keyboard shortcut to execute queries. Uses the same
 * Gruvpuccin / Tokyo Night theme system as the sandbox editor.
 */

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { sql } from "@codemirror/lang-sql"
import { bracketMatching } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view"
import { Button, Spinner } from "@flink-reactor/ui"
import { Play, Square } from "lucide-react"
import { useEffect, useRef } from "react"
import {
  createThemeCompartment,
  getActiveTheme,
  useCmPaletteObserver,
} from "@/lib/cm-themes"
import { useCatalogExploreStore } from "@/stores/catalog-explore-store"

const themeCompartment = createThemeCompartment()

/**
 * SQL editor with status indicator, run button, and cancel button.
 *
 * Displays the current query status (idle, submitting, running, completed,
 * failed, cancelled) in the toolbar. The CodeMirror editor supports
 * Cmd+Enter to execute and syncs with the catalog explore store.
 */
export function ExploreEditor() {
  const sql$ = useCatalogExploreStore((s) => s.sql)
  const setSql = useCatalogExploreStore((s) => s.setSql)
  const status = useCatalogExploreStore((s) => s.status)
  const executeQuery = useCatalogExploreStore((s) => s.executeQuery)
  const cancelQuery = useCatalogExploreStore((s) => s.cancelQuery)

  const isRunning = status === "submitting" || status === "running"

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const setSqlRef = useRef(setSql)
  const executeQueryRef = useRef(executeQuery)
  const isRunningRef = useRef(isRunning)

  setSqlRef.current = setSql
  executeQueryRef.current = executeQuery
  isRunningRef.current = isRunning

  // Create the CodeMirror editor on mount
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: sql$,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        sql(),
        placeholder("SELECT * FROM ..."),
        themeCompartment.of(getActiveTheme()),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              if (isRunningRef.current) return true
              executeQueryRef.current()
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setSqlRef.current(update.state.doc.toString())
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
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (e.g. template selector)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== sql$) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: sql$ },
      })
    }
  }, [sql$])

  // Watch for palette changes and reconfigure the theme compartment
  useCmPaletteObserver(viewRef, themeCompartment)

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {status === "submitting" && (
            <span className="flex items-center gap-1 text-fr-amber">
              <Spinner size="sm" />
              Submitting...
            </span>
          )}
          {status === "running" && (
            <span className="flex items-center gap-1 text-job-running">
              <Spinner size="sm" />
              Running
            </span>
          )}
          {status === "completed" && (
            <span className="text-job-finished">Completed</span>
          )}
          {status === "failed" && (
            <span className="text-job-failed">Failed</span>
          )}
          {status === "cancelled" && (
            <span className="text-job-cancelled">Cancelled</span>
          )}
          {status === "idle" && <span>Cmd+Enter to run</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelQuery}
              className="h-7 gap-1.5 text-xs text-job-failed"
            >
              <Square className="size-3" />
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={executeQuery}
            disabled={isRunning || !sql$.trim()}
            className="h-7 gap-1.5 text-xs"
          >
            {isRunning ? <Spinner size="sm" /> : <Play className="size-3" />}
            Run
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="[&_.cm-editor]:min-h-32 [&_.cm-editor]:outline-none [&_.cm-scroller]:max-h-96 [&_.cm-scroller]:overflow-y-auto"
      />
    </div>
  )
}
