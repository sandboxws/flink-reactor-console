import { javascript } from "@codemirror/lang-javascript"
import {
  bracketMatching,
  codeFolding,
  foldEffect,
  foldGutter,
  foldService,
} from "@codemirror/language"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { Spinner } from "@flink-reactor/ui"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { SiKubernetes } from "react-icons/si"
import { TbSql } from "react-icons/tb"
import { PlanAnalysisPanel } from "@/components/plan-analyzer/plan-analysis-panel"
import type {
  SqlFragment,
  StatementMeta,
  StatementOrigin,
} from "@/lib/sandbox-synthesizer"
import { usePlanAnalyzerStore } from "@/stores/plan-analyzer-store"
import { useSandboxStore } from "@/stores/sandbox-store"
import {
  cleanupConnectorTooltip,
  computeConnectorIcons,
  connectorIconGutter,
  setConnectorIcons,
} from "./connector-gutter"
import {
  computeSqlFocusLines,
  focusHighlightField,
  setFocusLines,
} from "./focus-highlight"
import { SynthInspector } from "./synth-inspector"
import { gruvpuccinCmTheme } from "./themes/gruvpuccin-cm-theme"
import { tokyoNightCmTheme } from "./themes/tokyo-night-cm-theme"

// ---------------------------------------------------------------------------
// Read-only CodeMirror viewer
// ---------------------------------------------------------------------------

const themeCompartment = new Compartment()

function getActiveTheme() {
  if (typeof document === "undefined") return gruvpuccinCmTheme
  return document.documentElement.dataset.palette === "tokyo-night"
    ? tokyoNightCmTheme
    : gruvpuccinCmTheme
}

/**
 * Fold service that tells CM6 where CREATE TABLE folds are possible.
 * This ensures the fold gutter always shows ▾/▸ on CREATE TABLE lines,
 * even after the user unfolds them.
 */
const createTableFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart)
  const text = line.text.trimStart()
  if (!text.startsWith("CREATE TABLE")) return null

  // Find the end of the statement (the line ending with ;)
  let endLine = line
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    endLine = state.doc.line(n)
    if (endLine.text.trimEnd().endsWith(";")) break
  }

  // Fold from end of first line to end of last line
  return { from: line.to, to: endLine.to }
})

/**
 * Compute fold ranges for CREATE TABLE statements.
 * Keeps the first line (CREATE TABLE `name` (...) visible and folds the body
 * so it's obvious the DDL exists and can be expanded.
 */
function computeCreateTableFolds(
  statements: readonly string[],
  commentIndices: ReadonlySet<number>,
): Array<{ from: number; to: number }> {
  const folds: Array<{ from: number; to: number }> = []
  let docPos = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const stmtEnd = docPos + stmt.length

    if (
      i > 0 &&
      commentIndices.has(i - 1) &&
      stmt.trimStart().startsWith("CREATE TABLE")
    ) {
      // Find the end of the first line within the statement
      const firstNewline = stmt.indexOf("\n")
      if (firstNewline > 0) {
        // Fold from end of first line to end of statement
        folds.push({ from: docPos + firstNewline, to: stmtEnd })
      }
    }

    docPos = stmtEnd + 2 // +2 for \n\n separator
  }

  return folds
}

interface CodeViewerProps {
  value: string
  focusComponents?: string[] | null
  statements?: readonly string[]
  statementOrigins?: ReadonlyMap<number, StatementOrigin>
  statementContributors?: ReadonlyMap<number, readonly SqlFragment[]>
  commentIndices?: ReadonlySet<number>
  statementMeta?: ReadonlyMap<number, StatementMeta>
}

function CodeViewer({
  value,
  focusComponents,
  statements,
  statementOrigins,
  statementContributors,
  commentIndices,
  statementMeta,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Create the EditorView once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        bracketMatching(),
        javascript(),
        codeFolding({ placeholderText: "…" }),
        createTableFoldService,
        foldGutter({
          openText: "▾",
          closedText: "▸",
        }),
        // connectorIconGutter, // disabled — revisit icon design
        focusHighlightField,
        themeCompartment.of(getActiveTheme()),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      cleanupConnectorTooltip()
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Update content + focus decorations atomically when props change
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentDoc = view.state.doc.toString()
    const effects: import("@codemirror/state").StateEffect<unknown>[] = []

    // Replace document content if changed
    const changes =
      currentDoc !== value
        ? { from: 0, to: currentDoc.length, insert: value }
        : undefined

    // Compute focus decorations
    if (
      focusComponents &&
      focusComponents.length > 0 &&
      statements &&
      statementOrigins
    ) {
      const lines = computeSqlFocusLines(
        value,
        statements,
        statementOrigins,
        statementContributors ?? new Map(),
        focusComponents,
        commentIndices,
      )
      effects.push(setFocusLines.of(lines))
    } else if (commentIndices && commentIndices.size > 0 && statements) {
      // No focus active, but apply comment line styling
      const commentLines = new Set<number>()
      let cl = 0
      for (let si = 0; si < statements.length; si++) {
        const sLines = statements[si].split("\n")
        if (commentIndices.has(si)) {
          for (let j = 0; j < sLines.length; j++) {
            commentLines.add(cl + j)
          }
        }
        cl += sLines.length + 1
      }
      effects.push(
        setFocusLines.of({
          dimLines: new Set(),
          dimSpans: [],
          commentLines,
        }),
      )
    } else {
      effects.push(setFocusLines.of(null))
    }

    // Dispatch content + decorations in a single transaction
    if (changes || effects.length > 0) {
      view.dispatch({ changes, effects })
    }

    // Auto-fold CREATE TABLE statements when content changes
    if (changes && statements && commentIndices && commentIndices.size > 0) {
      const postEffects: import("@codemirror/state").StateEffect<unknown>[] = []

      const folds = computeCreateTableFolds(statements, commentIndices)
      for (const f of folds) {
        postEffects.push(foldEffect.of(f))
      }

      if (postEffects.length > 0) {
        view.dispatch({ effects: postEffects })
      }
    }
  }, [
    value,
    focusComponents,
    statements,
    statementOrigins,
    statementContributors,
    commentIndices,
    statementMeta,
  ])

  // Watch for palette changes
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

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
  }, [text])

  return (
    <Button variant="ghost" size="sm" onClick={copy} title="Copy to clipboard">
      Copy
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------

function SynthesisErrorDisplay() {
  const synthError = useSandboxStore((s) => s.synthError)
  const errorKind = useSandboxStore((s) => s.synthErrorKind)
  const errorLine = useSandboxStore((s) => s.synthErrorLine)
  const errorColumn = useSandboxStore((s) => s.synthErrorColumn)
  const diagnostics = useSandboxStore((s) => s.diagnostics)

  if (!synthError && diagnostics.length === 0) return null

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      {synthError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
          <h3 className="mb-1 text-sm font-semibold text-red-400">
            {errorKind === "transpile"
              ? "Syntax Error"
              : errorKind === "synthesis"
                ? "Synthesis Error"
                : "Unexpected Error"}
          </h3>
          <pre className="whitespace-pre-wrap font-mono text-xs text-red-300">
            {synthError}
          </pre>
          {errorLine != null && (
            <p className="mt-1 text-xs text-red-400/70">
              Line {errorLine}
              {errorColumn != null && `, Column ${errorColumn}`}
            </p>
          )}
        </div>
      )}

      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-2">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className={`rounded-md border p-2 text-xs ${
                d.severity === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {d.componentName && (
                <span className="mr-2 font-semibold">[{d.componentName}]</span>
              )}
              {d.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Spinner size="lg" className="text-fr-purple" />
      <span className="text-sm text-zinc-500">Loading DSL...</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible Synth Inspector
// ---------------------------------------------------------------------------

function CollapsibleInspector({
  statements,
  statementOrigins,
  statementContributors,
}: {
  statements: readonly string[]
  statementOrigins: ReadonlyMap<number, StatementOrigin>
  statementContributors: ReadonlyMap<number, readonly SqlFragment[]>
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="shrink-0 border-t border-dash-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-full items-center gap-1.5 px-3 text-left hover:bg-white/5"
      >
        {open ? (
          <ChevronDown className="size-3 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3 text-zinc-500" />
        )}
        <span className="text-[11px] font-medium text-zinc-500">
          Synth Inspector
        </span>
      </button>
      {open && (
        <div className="h-56 overflow-auto border-t border-dash-border p-2 font-mono text-xs leading-5">
          <SynthInspector
            statements={statements}
            statementOrigins={statementOrigins}
            statementContributors={statementContributors}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Synthesis content (loading / error / empty / results for SQL & CRD)
// ---------------------------------------------------------------------------

function SynthesisTabContent({
  tab,
  focusComponents,
}: {
  tab: "sql" | "crd"
  focusComponents?: string[] | null
}) {
  const status = useSandboxStore((s) => s.status)
  const pipelines = useSandboxStore((s) => s.pipelines)
  const dslLoading = useSandboxStore((s) => s.dslLoading)

  if (dslLoading) {
    return <LoadingSkeleton />
  }

  if (status === "error") {
    return <SynthesisErrorDisplay />
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-zinc-500">
          {status === "synthesizing"
            ? "Synthesizing..."
            : "Output will appear here"}
        </span>
      </div>
    )
  }

  const pipeline = pipelines[0]

  if (tab === "crd") {
    return <CodeViewer value={pipeline.crdYaml} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeViewer
          value={pipeline.sql}
          focusComponents={focusComponents}
          statements={pipeline.statements}
          statementOrigins={pipeline.statementOrigins}
          statementContributors={pipeline.statementContributors}
          commentIndices={pipeline.commentIndices}
          statementMeta={pipeline.statementMeta}
        />
      </div>
      <CollapsibleInspector
        statements={pipeline.statements}
        statementOrigins={pipeline.statementOrigins}
        statementContributors={pipeline.statementContributors}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible Explain Output (raw plan text from SQL Gateway)
// ---------------------------------------------------------------------------

function CollapsibleExplainOutput() {
  const [open, setOpen] = useState(false)
  const planText = usePlanAnalyzerStore((s) => s.planText)

  if (!planText) return null

  return (
    <div className="shrink-0 border-t border-dash-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-full items-center gap-1.5 px-3 text-left hover:bg-white/5"
      >
        {open ? (
          <ChevronDown className="size-3 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3 text-zinc-500" />
        )}
        <span className="text-[11px] font-medium text-zinc-500">
          Explain Output
        </span>
      </button>
      {open && (
        <div className="h-56 overflow-auto border-t border-dash-border p-2">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-zinc-400">
            {planText}
          </pre>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Explain tab content
// ---------------------------------------------------------------------------

function ExplainTabContent() {
  const pipelines = useSandboxStore((s) => s.pipelines)
  const synthStatus = useSandboxStore((s) => s.status)
  const activeOutputTab = useSandboxStore((s) => s.activeOutputTab)

  const analyzedPlan = usePlanAnalyzerStore((s) => s.analyzedPlan)
  const analyzerStatus = usePlanAnalyzerStore((s) => s.status)
  const analyzerError = usePlanAnalyzerStore((s) => s.error)
  const explainSQL = usePlanAnalyzerStore((s) => s.explainSQL)
  const sourceSQL = usePlanAnalyzerStore((s) => s.sourceSQL)

  const sql = pipelines[0]?.sql ?? ""

  // Track the last SQL we attempted to explain so we don't retry on error
  const lastAttemptedSQL = useRef("")

  // Auto-explain when tab is active and we have synthesized SQL
  useEffect(() => {
    if (activeOutputTab !== "explain") return
    if (!sql) return
    if (analyzerStatus === "analyzing") return
    // Already explained this exact SQL successfully
    if (analyzerStatus === "done" && sourceSQL === sql) return
    // Don't retry the same SQL that already failed
    if (analyzerStatus === "error" && lastAttemptedSQL.current === sql) return

    // Guard against React strict-mode double-fire
    let cancelled = false
    lastAttemptedSQL.current = sql
    // Defer to avoid calling during render cycle
    const id = setTimeout(() => {
      if (!cancelled) explainSQL(sql)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [activeOutputTab, sql, explainSQL, analyzerStatus, sourceSQL])

  if (synthStatus === "synthesizing" || analyzerStatus === "analyzing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Spinner size="lg" className="text-fr-purple" />
        <span className="text-sm text-zinc-500">
          {synthStatus === "synthesizing"
            ? "Synthesizing..."
            : "Explaining SQL..."}
        </span>
      </div>
    )
  }

  if (analyzerStatus === "error" && analyzerError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-400">{analyzerError}</p>
        </div>
      </div>
    )
  }

  if (analyzedPlan) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <PlanAnalysisPanel plan={analyzedPlan} />
        </div>
        <CollapsibleExplainOutput />
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <span className="text-center text-sm text-zinc-500">
        Synthesize a pipeline to see its execution plan
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main output component
// ---------------------------------------------------------------------------

export function SynthesisOutput({
  focusComponents,
}: {
  focusComponents?: string[] | null
}) {
  const pipelines = useSandboxStore((s) => s.pipelines)
  const activeOutputTab = useSandboxStore((s) => s.activeOutputTab)
  const setActiveOutputTab = useSandboxStore((s) => s.setActiveOutputTab)

  const pipeline = pipelines[0]
  const sqlText = pipeline?.sql ?? ""
  const crdText = pipeline?.crdYaml ?? ""

  return (
    <Tabs
      value={activeOutputTab}
      onValueChange={(v) => setActiveOutputTab(v as "sql" | "crd" | "explain")}
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b border-dash-border px-2">
        <TabsList>
          <TabsTrigger
            value="sql"
            className="gap-1.5 data-[state=active]:text-fr-purple data-[state=inactive]:text-zinc-500"
          >
            <TbSql className="size-4" />
            SQL
          </TabsTrigger>
          <TabsTrigger
            value="crd"
            className="gap-1.5 data-[state=active]:text-fr-purple data-[state=inactive]:text-zinc-500"
          >
            <SiKubernetes className="size-3" />
            CRD
          </TabsTrigger>
          <TabsTrigger
            value="explain"
            className="gap-1.5 data-[state=active]:text-fr-purple data-[state=inactive]:text-zinc-500"
          >
            <Search className="size-3" />
            Explain
          </TabsTrigger>
        </TabsList>

        {activeOutputTab !== "explain" && (
          <CopyButton text={activeOutputTab === "sql" ? sqlText : crdText} />
        )}
      </div>

      <TabsContent value="sql" className="flex-1 overflow-hidden">
        <SynthesisTabContent tab="sql" focusComponents={focusComponents} />
      </TabsContent>

      <TabsContent value="crd" className="flex-1 overflow-hidden">
        <SynthesisTabContent tab="crd" />
      </TabsContent>

      <TabsContent value="explain" className="h-0 flex-1 overflow-hidden">
        <ExplainTabContent />
      </TabsContent>
    </Tabs>
  )
}
