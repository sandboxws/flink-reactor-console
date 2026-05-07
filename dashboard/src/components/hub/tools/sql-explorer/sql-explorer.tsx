/**
 * SQL Explorer shell — 3-column full-bleed workspace.
 *
 * Left:   `<SavedQueriesPane>` (localStorage-backed bookmarks)
 * Center: CodeMirror SQL editor + result table
 * Right:  `<SchemaNavigatorPane>` (catalog tree)
 *
 * Run, Save, and Share live on the editor toolbar. Share copies a URL
 * with the SQL encoded as `?q=<base64>` so it can be pasted into Slack /
 * docs and round-tripped.
 */

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { sql as cmSql } from "@codemirror/lang-sql"
import { bracketMatching } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view"
import { Bookmark, Link2, Play, Square } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  createThemeCompartment,
  getActiveTheme,
  useCmPaletteObserver,
} from "@/lib/cm-themes"
import { useCatalogExploreStore } from "@/stores/catalog-explore-store"
import {
  loadSavedQueries,
  SavedQueriesPane,
  type SavedQuery,
} from "./saved-queries-pane"
import { SchemaNavigatorPane } from "./schema-navigator-pane"

const themeCompartment = createThemeCompartment()

interface SqlExplorerProps {
  /** Initial SQL — usually the `?q=` param decoded by the route. */
  initialSql?: string
}

export function SqlExplorer({ initialSql }: SqlExplorerProps) {
  const sql$ = useCatalogExploreStore((s) => s.sql)
  const setSql = useCatalogExploreStore((s) => s.setSql)
  const status = useCatalogExploreStore((s) => s.status)
  const columns = useCatalogExploreStore((s) => s.columns)
  const rows = useCatalogExploreStore((s) => s.rows)
  const error = useCatalogExploreStore((s) => s.error)
  const executeQuery = useCatalogExploreStore((s) => s.executeQuery)
  const cancelQuery = useCatalogExploreStore((s) => s.cancelQuery)

  const [saved, setSaved] = useState<SavedQuery[]>([])
  const [shareToast, setShareToast] = useState<string | null>(null)

  // Load saved queries once on mount
  useEffect(() => {
    setSaved(loadSavedQueries())
  }, [])

  // Apply initial SQL once on mount
  const appliedInitial = useRef(false)
  useEffect(() => {
    if (appliedInitial.current) return
    appliedInitial.current = true
    if (initialSql && initialSql !== sql$) {
      setSql(initialSql)
    }
  }, [initialSql, setSql, sql$])

  const isRunning = status === "submitting" || status === "running"

  // Editor wiring
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const setSqlRef = useRef(setSql)
  const executeQueryRef = useRef(executeQuery)
  const isRunningRef = useRef(isRunning)
  setSqlRef.current = setSql
  executeQueryRef.current = executeQuery
  isRunningRef.current = isRunning

  useEffect(() => {
    if (!containerRef.current) return
    const state = EditorState.create({
      doc: sql$,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        cmSql(),
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
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql$])

  // Sync external value changes (e.g., loading a saved query)
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

  useCmPaletteObserver(viewRef, themeCompartment)

  const onLoad = useCallback(
    (sql: string) => {
      setSql(sql)
    },
    [setSql],
  )

  const onPickTable = useCallback((qualifiedName: string) => {
    const view = viewRef.current
    if (!view) return
    // Insert at cursor; if editor is empty, prefill SELECT.
    const current = view.state.doc.toString()
    const insert =
      current.trim() === ""
        ? `SELECT * FROM ${qualifiedName} LIMIT 100`
        : qualifiedName
    const sel = view.state.selection.main
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + insert.length },
    })
    view.focus()
  }, [])

  const save = () => {
    const text = sql$.trim()
    if (!text) return
    const name =
      text.replace(/\s+/g, " ").slice(0, 50) + (text.length > 50 ? "…" : "")
    const next: SavedQuery = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      sql: text,
      savedAt: new Date().toISOString(),
    }
    setSaved((prev) => [next, ...prev])
  }

  const share = async () => {
    const text = sql$.trim()
    if (!text) return
    try {
      const encoded = btoa(unescape(encodeURIComponent(text)))
      const url = `${window.location.origin}/hub/sql-explorer?q=${encoded}`
      await navigator.clipboard.writeText(url)
      setShareToast("URL copied to clipboard")
      setTimeout(() => setShareToast(null), 2000)
    } catch {
      setShareToast("Could not copy URL")
      setTimeout(() => setShareToast(null), 2000)
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px,1fr,280px]">
      <SavedQueriesPane saved={saved} setSaved={setSaved} onLoad={onLoad} />

      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-dash-border bg-dash-surface/40 px-4">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
            SQL editor
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!sql$.trim()}
              className="btn btn-ghost btn-sm"
            >
              <Bookmark className="size-3" />
              Save
            </button>
            <button
              type="button"
              onClick={share}
              disabled={!sql$.trim()}
              className="btn btn-ghost btn-sm"
            >
              <Link2 className="size-3" />
              Share
            </button>
            {isRunning ? (
              <button
                type="button"
                onClick={cancelQuery}
                className="btn btn-secondary btn-sm"
              >
                <Square className="size-3" />
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={executeQuery}
                disabled={!sql$.trim()}
                className="btn btn-secondary btn-sm"
              >
                <Play className="size-3" />
                Run
              </button>
            )}
          </div>
        </div>
        <div
          ref={containerRef}
          className="h-[40%] min-h-[160px] [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:h-full"
        />
        <div className="flex min-h-0 flex-1 flex-col border-t border-dash-border">
          <ResultsPane
            status={status}
            columns={columns}
            rows={rows}
            error={error}
          />
        </div>
        {shareToast ? (
          <div className="pointer-events-none absolute bottom-4 right-1/2 translate-x-1/2 rounded-md border border-dash-border bg-dash-panel/90 px-3 py-1.5 font-mono text-[11px] text-fg backdrop-blur">
            {shareToast}
          </div>
        ) : null}
      </div>

      <SchemaNavigatorPane onPick={onPickTable} />
    </div>
  )
}

interface ResultsPaneProps {
  status: ReturnType<typeof useCatalogExploreStore.getState>["status"]
  columns: { name: string; dataType: string }[]
  rows: (string | null)[][]
  error: string | null
}

function ResultsPane({ status, columns, rows, error }: ResultsPaneProps) {
  if (error) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 font-mono text-[11.5px] text-fg whitespace-pre-wrap">
          {error}
        </div>
      </div>
    )
  }
  if (status === "idle" && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-mono text-[11px] text-fg-faint">
          Cmd+Enter to run · results render here
        </p>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-mono text-[11px] text-fg-faint">
          {status === "submitting"
            ? "Submitting…"
            : status === "running"
              ? "Streaming results…"
              : "No rows returned."}
        </p>
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-dash-border px-4 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span>
          Results · {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
          {columns.length} column{columns.length === 1 ? "" : "s"} · {status}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-dash-surface">
            <tr className="border-b border-dash-border text-left text-fg-faint">
              {columns.map((c) => (
                <th
                  key={c.name}
                  className="whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-wider"
                >
                  {c.name}
                  <span className="ml-1 normal-case text-fg-faint/70">
                    {c.dataType}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border/40">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-dash-elevated/30">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="whitespace-nowrap px-3 py-1.5 font-mono text-[11.5px] text-fg"
                  >
                    {cell ?? <span className="text-fg-faint">NULL</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
