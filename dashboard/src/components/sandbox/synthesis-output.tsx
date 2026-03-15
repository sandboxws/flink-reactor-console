import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching } from "@codemirror/language"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { SiKubernetes } from "react-icons/si"
import { TbSql } from "react-icons/tb"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SqlFragment, StatementOrigin } from "@/lib/sandbox-synthesizer"
import { useSandboxStore } from "@/stores/sandbox-store"
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
  if (typeof document === "undefined") return tokyoNightCmTheme
  return document.documentElement.dataset.palette === "gruvpuccin"
    ? gruvpuccinCmTheme
    : tokyoNightCmTheme
}

interface CodeViewerProps {
  value: string
  focusComponents?: string[] | null
  statements?: readonly string[]
  statementOrigins?: ReadonlyMap<number, StatementOrigin>
  statementContributors?: ReadonlyMap<number, readonly SqlFragment[]>
}

function CodeViewer({
  value,
  focusComponents,
  statements,
  statementOrigins,
  statementContributors,
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
      )
      effects.push(setFocusLines.of(lines))
    } else {
      effects.push(setFocusLines.of(null))
    }

    // Dispatch content + decorations in a single transaction
    if (changes || effects.length > 0) {
      view.dispatch({ changes, effects })
    }
  }, [value, focusComponents, statements, statementOrigins, statementContributors])

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
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-fr-purple" />
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
// Main output component
// ---------------------------------------------------------------------------

export function SynthesisOutput({
  focusComponents,
}: {
  focusComponents?: string[] | null
}) {
  const status = useSandboxStore((s) => s.status)
  const pipelines = useSandboxStore((s) => s.pipelines)
  const dslLoading = useSandboxStore((s) => s.dslLoading)
  const activeOutputTab = useSandboxStore((s) => s.activeOutputTab)
  const setActiveOutputTab = useSandboxStore((s) => s.setActiveOutputTab)

  // Show loading skeleton during initial DSL bundle load
  if (dslLoading) {
    return <LoadingSkeleton />
  }

  // Show errors
  if (status === "error") {
    return <SynthesisErrorDisplay />
  }

  // No result yet
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

  const sqlText = pipeline.sql
  const crdText = pipeline.crdYaml

  return (
    <Tabs
      value={activeOutputTab}
      onValueChange={(v) => setActiveOutputTab(v as "sql" | "crd")}
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
        </TabsList>

        <CopyButton text={activeOutputTab === "sql" ? sqlText : crdText} />
      </div>

      <TabsContent value="sql" className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeViewer
              value={sqlText}
              focusComponents={focusComponents}
              statements={pipeline.statements}
              statementOrigins={pipeline.statementOrigins}
              statementContributors={pipeline.statementContributors}
            />
          </div>
          <CollapsibleInspector
            statements={pipeline.statements}
            statementOrigins={pipeline.statementOrigins}
            statementContributors={pipeline.statementContributors}
          />
        </div>
      </TabsContent>

      <TabsContent value="crd" className="flex-1 overflow-hidden">
        <CodeViewer value={crdText} />
      </TabsContent>
    </Tabs>
  )
}
