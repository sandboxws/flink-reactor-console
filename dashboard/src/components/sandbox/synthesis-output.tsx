import { useEffect, useRef, useCallback } from "react"
import { EditorState, Compartment } from "@codemirror/state"
import { EditorView, lineNumbers } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { bracketMatching } from "@codemirror/language"
import { Database, Box } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useSandboxStore } from "@/stores/sandbox-store"
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

function CodeViewer({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        bracketMatching(),
        javascript(),
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

    return () => view.destroy()
  }, [value])

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
// Main output component
// ---------------------------------------------------------------------------

export function SynthesisOutput() {
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
            <Database className="size-3" />
            SQL
          </TabsTrigger>
          <TabsTrigger
            value="crd"
            className="gap-1.5 data-[state=active]:text-fr-purple data-[state=inactive]:text-zinc-500"
          >
            <Box className="size-3" />
            CRD
          </TabsTrigger>
        </TabsList>

        <CopyButton text={activeOutputTab === "sql" ? sqlText : crdText} />
      </div>

      <TabsContent value="sql" className="flex-1 overflow-hidden">
        <CodeViewer value={sqlText} />
      </TabsContent>

      <TabsContent value="crd" className="flex-1 overflow-hidden">
        <CodeViewer value={crdText} />
      </TabsContent>
    </Tabs>
  )
}
