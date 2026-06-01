/**
 * SQL Explorer shell — 3-column full-bleed console.
 *
 * Left:   `<SavedQueriesPane>` (localStorage-backed bookmarks)
 * Center: CodeMirror multi-statement editor + per-statement result tabs
 * Right:  `<ConsoleInspector>` — identity + "Open job in Console" for the
 *         selected statement's Flink job
 *
 * Run all (⌘⇧⏎) splits the script and runs statements sequentially in one
 * session; Run statement / Run selection (⌘⏎) runs the highlighted text, or the
 * statement under the caret. Save, and Share live on the editor toolbar; Share
 * copies a URL with the SQL encoded as `?q=<base64>`.
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
import { Popover, PopoverContent, PopoverTrigger } from "@flink-reactor/ui"
import {
  Bookmark,
  ChevronsRight,
  Link2,
  Play,
  SlidersHorizontal,
  Square,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  createThemeCompartment,
  getActiveTheme,
  useCmPaletteObserver,
} from "@/lib/cm-themes"
import { cn } from "@/lib/cn"
import { useCatalogExploreStore } from "@/stores/catalog-explore-store"
import { ConsoleInspector } from "./console-inspector"
import { QueryTemplateDialog } from "./query-template-dialog"
import { ResultsTabs } from "./results-tabs"
import {
  loadSavedQueries,
  SavedQueriesPane,
  type SavedQuery,
} from "./saved-queries-pane"

const themeCompartment = createThemeCompartment()

/** Extract the `;`-bounded statement containing `pos` (no string-literal awareness). */
function statementAtCursor(doc: string, pos: number): string {
  const before = doc.lastIndexOf(";", Math.max(0, pos - 1))
  const after = doc.indexOf(";", pos)
  const start = before === -1 ? 0 : before + 1
  const end = after === -1 ? doc.length : after
  return doc.slice(start, end).trim()
}

interface SqlExplorerProps {
  /** Initial SQL — usually the `?q=` param decoded by the route. */
  initialSql?: string
}

export function SqlExplorer({ initialSql }: SqlExplorerProps) {
  const sql$ = useCatalogExploreStore((s) => s.sql)
  const setSql = useCatalogExploreStore((s) => s.setSql)
  const status = useCatalogExploreStore((s) => s.status)
  const error = useCatalogExploreStore((s) => s.error)
  const statements = useCatalogExploreStore((s) => s.statements)
  const activeIndex = useCatalogExploreStore((s) => s.activeIndex)
  const sessionHandle = useCatalogExploreStore((s) => s.sessionHandle)
  const executeAll = useCatalogExploreStore((s) => s.executeAll)
  const executeSelection = useCatalogExploreStore((s) => s.executeSelection)
  const setActiveStatement = useCatalogExploreStore((s) => s.setActiveStatement)
  const cancelQuery = useCatalogExploreStore((s) => s.cancelQuery)
  const runtimeMode = useCatalogExploreStore((s) => s.runtimeMode)
  const setRuntimeMode = useCatalogExploreStore((s) => s.setRuntimeMode)
  const maxRows = useCatalogExploreStore((s) => s.maxRows)
  const setMaxRows = useCatalogExploreStore((s) => s.setMaxRows)
  const stateTtl = useCatalogExploreStore((s) => s.stateTtl)
  const setStateTtl = useCatalogExploreStore((s) => s.setStateTtl)

  const [saved, setSaved] = useState<SavedQuery[]>([])
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)

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

  // Run handlers — held in refs so the once-mounted editor keymap and the
  // toolbar buttons invoke the same up-to-date closures.
  const runAll = () => {
    if (isRunning) return
    void executeAll()
  }
  const runSelectionOrStatement = () => {
    const view = viewRef.current
    if (!view || isRunning) return
    const sel = view.state.selection.main
    const text = sel.empty
      ? statementAtCursor(view.state.doc.toString(), sel.head)
      : view.state.sliceDoc(sel.from, sel.to)
    if (text.trim()) void executeSelection(text)
  }

  // Editor wiring
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const setSqlRef = useRef(setSql)
  const setHasSelectionRef = useRef(setHasSelection)
  const runAllRef = useRef(runAll)
  const runSelRef = useRef(runSelectionOrStatement)
  setSqlRef.current = setSql
  setHasSelectionRef.current = setHasSelection
  runAllRef.current = runAll
  runSelRef.current = runSelectionOrStatement

  useEffect(() => {
    if (!containerRef.current) return
    const state = EditorState.create({
      doc: useCatalogExploreStore.getState().sql,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        cmSql(),
        placeholder("SELECT * FROM ...  (⌘⏎ run statement · ⌘⇧⏎ run all)"),
        themeCompartment.of(getActiveTheme()),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              runSelRef.current()
              return true
            },
          },
          {
            key: "Mod-Shift-Enter",
            run: () => {
              runAllRef.current()
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setSqlRef.current(update.state.doc.toString())
          }
          if (update.selectionSet || update.docChanged) {
            setHasSelectionRef.current(!update.state.selection.main.empty)
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
  }, [])

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

  const onLoad = (sql: string) => {
    setSql(sql)
  }

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
    <div className="grid h-full min-h-0 grid-cols-[260px_1fr_360px]">
      <SavedQueriesPane saved={saved} setSaved={setSaved} onLoad={onLoad} />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-dash-border bg-dash-surface/40 px-4">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
            Console
          </span>
          <div className="flex items-center gap-2">
            <QueryTemplateDialog onSelect={onLoad} />
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
            <div className="flex items-center gap-0.5 rounded-md border border-dash-border p-0.5">
              {(["STREAMING", "BATCH"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRuntimeMode(mode)}
                  aria-pressed={runtimeMode === mode}
                  title={
                    mode === "STREAMING"
                      ? "Streaming — continuous/updating results; required for unbounded sources (Kafka)"
                      : "Batch — final results; needed for full sorts & non-windowed aggregations over bounded sources (JDBC)"
                  }
                  className={cn(
                    "rounded px-2 py-1 font-sans text-[11px] leading-none transition-colors",
                    runtimeMode === mode
                      ? "bg-dash-elevated text-fg"
                      : "text-fg-faint hover:text-fg",
                  )}
                >
                  {mode === "STREAMING" ? "Streaming" : "Batch"}
                </button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Query settings"
                >
                  <SlidersHorizontal className="size-3" />
                  Settings
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-64 border-dash-border bg-dash-panel p-3"
              >
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
                      Max rows
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={100}
                      value={maxRows}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value))
                        if (Number.isFinite(n) && n >= 1) setMaxRows(n)
                      }}
                      className="rounded-md border border-dash-border bg-transparent px-2 py-1 font-mono text-[11px] text-fg focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                    />
                    <span className="font-mono text-[10px] text-fg-faint">
                      Rows fetched per statement before auto-stopping.
                    </span>
                  </label>

                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
                      State TTL
                    </span>
                    <div className="flex items-center gap-0.5 rounded-md border border-dash-border p-0.5">
                      {(["off", "1 h", "6 h", "24 h"] as const).map((ttl) => (
                        <button
                          key={ttl}
                          type="button"
                          onClick={() => setStateTtl(ttl)}
                          aria-pressed={stateTtl === ttl}
                          className={cn(
                            "flex-1 rounded px-1.5 py-1 font-mono text-[10.5px] leading-none transition-colors",
                            stateTtl === ttl
                              ? "bg-dash-elevated text-fg"
                              : "text-fg-faint hover:text-fg",
                          )}
                        >
                          {ttl === "off" ? "Off" : ttl}
                        </button>
                      ))}
                    </div>
                    <span className="font-mono text-[10px] text-fg-faint">
                      Bounds streaming state growth. No effect in batch.
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
              <>
                <button
                  type="button"
                  onClick={runAll}
                  disabled={!sql$.trim()}
                  className="btn btn-ghost btn-sm"
                  title="Run all statements (⌘⇧⏎)"
                >
                  <ChevronsRight className="size-3" />
                  Run all
                </button>
                <button
                  type="button"
                  onClick={runSelectionOrStatement}
                  disabled={!sql$.trim()}
                  className="btn btn-secondary btn-sm"
                  title={
                    hasSelection
                      ? "Run selection (⌘⏎)"
                      : "Run statement under caret (⌘⏎)"
                  }
                >
                  <Play className="size-3" />
                  {hasSelection ? "Run selection" : "Run statement"}
                </button>
              </>
            )}
          </div>
        </div>
        <div
          ref={containerRef}
          className="h-[40%] min-h-[160px] [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:h-full"
        />
        <div className="flex min-h-0 flex-1 flex-col border-t border-dash-border">
          <ResultsTabs
            statements={statements}
            activeIndex={activeIndex}
            status={status}
            error={error}
            onSelect={setActiveStatement}
          />
        </div>
        {shareToast ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-dash-border bg-dash-panel/90 px-3 py-1.5 font-mono text-[11px] text-fg backdrop-blur">
            {shareToast}
          </div>
        ) : null}
      </div>

      <ConsoleInspector
        statement={statements[activeIndex] ?? null}
        sessionHandle={sessionHandle}
      />
    </div>
  )
}
