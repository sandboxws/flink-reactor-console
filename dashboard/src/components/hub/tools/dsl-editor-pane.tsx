/**
 * Hub DSL editor pane — center column of the sandbox workspace.
 *
 * Mirrors `console-v2/sandbox.html` lines 107-228:
 *
 *   ┌── file tabs (active scratchpad highlighted) ──────────────────┐
 *   │ orders-enrich.fr.ts  device-window.fr.ts                       │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │ CodeMirror 6 editor (Gruvpuccin theme, DSL autocompletion)     │
 *   ├── status footer (cursor pos · line count · type-check) ───────┤
 *   ├── preview tabs (Plan graph · Generated SQL · Job config · Validation)
 *   └── preview content (driven by the active tab)                  │
 *
 * State comes from `useSandboxStore`; the preview tab choice is local
 * (no need to persist across reloads).
 */

import { Eye, WandSparkles } from "lucide-react"
import { useState } from "react"
import { SandboxEditor } from "@/components/sandbox/sandbox-editor"
import { SynthesisOutput } from "@/components/sandbox/synthesis-output"
import { findTemplate } from "@/components/sandbox/templates"
import { useSandboxStore } from "@/stores/sandbox-store"

type PreviewTab = "plan" | "sql" | "config" | "validation"

export function DslEditorPane() {
  const code = useSandboxStore((s) => s.code)
  const setCode = useSandboxStore((s) => s.setCode)
  const synthesize = useSandboxStore((s) => s.synthesize)
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const activeTemplate = useSandboxStore((s) => s.activeTemplate)
  const setActiveOutputTab = useSandboxStore((s) => s.setActiveOutputTab)

  const [previewTab, setPreviewTab] = useState<PreviewTab>("plan")

  const lines = code.split("\n").length
  const errorCount = diagnostics.filter((d) => d.severity === "error").length
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length

  // Build a virtual "file" name for the editor tab.
  const fileName = activeTemplate ? `${activeTemplate}.fr.ts` : "scratch.fr.ts"
  const description = activeTemplate ? findTemplate(activeTemplate)?.name : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-fr-bg/60">
      {/* File tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-dash-border bg-dash-surface/30 px-3 pt-2">
        <span
          className="flex items-center gap-2 rounded-t-md border border-b-0 border-dash-border bg-fr-bg px-3 py-1.5 font-mono text-[12px] text-fg"
          title={description ?? undefined}
        >
          <span className="size-2 rounded-full bg-fr-coral" />
          {fileName}
        </span>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <SandboxEditor
          value={code}
          onChange={setCode}
          onSynthesize={synthesize}
          diagnostics={diagnostics}
        />
      </div>

      {/* Status footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-dash-border bg-dash-surface/40 px-4 py-2">
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-fg-faint">
          <span>
            {lines} line{lines === 1 ? "" : "s"}
          </span>
          <span>·</span>
          {errorCount > 0 ? (
            <span className="text-fr-rose">
              {errorCount} error{errorCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-fr-sage">type-check ✓</span>
          )}
          <span>·</span>
          {warnCount > 0 ? (
            <span className="text-fr-amber">
              {warnCount} warning{warnCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-fr-sage">DSL valid ✓</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled>
            <WandSparkles className="size-3.5" />
            Format
          </button>
          <button
            type="button"
            onClick={synthesize}
            className="btn btn-secondary btn-sm"
          >
            <Eye className="size-3.5" />
            Live preview
          </button>
        </div>
      </div>

      {/* Preview tabs */}
      <div className="flex shrink-0 border-t border-dash-border bg-dash-surface/40 px-4">
        <PreviewTabButton
          active={previewTab === "plan"}
          onClick={() => {
            setPreviewTab("plan")
            setActiveOutputTab("explain")
          }}
        >
          Plan graph
        </PreviewTabButton>
        <PreviewTabButton
          active={previewTab === "sql"}
          onClick={() => {
            setPreviewTab("sql")
            setActiveOutputTab("sql")
          }}
        >
          Generated SQL
        </PreviewTabButton>
        <PreviewTabButton
          active={previewTab === "config"}
          onClick={() => {
            setPreviewTab("config")
            setActiveOutputTab("crd")
          }}
        >
          Job config
        </PreviewTabButton>
        <PreviewTabButton
          active={previewTab === "validation"}
          onClick={() => setPreviewTab("validation")}
          count={errorCount + warnCount}
        >
          Validation
        </PreviewTabButton>
      </div>

      {/* Preview content — reuse SynthesisOutput for plan/sql/config; render
          a simple diagnostics list for the validation tab. */}
      <div className="min-h-[200px] shrink-0 overflow-hidden border-t border-dash-border bg-fr-bg/60">
        {previewTab === "validation" ? (
          <ValidationList />
        ) : (
          <div className="h-[260px] overflow-hidden">
            <SynthesisOutput focusComponents={null} />
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewTabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tab ${active ? "active" : ""}`}
    >
      {children}
      {count && count > 0 ? (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fr-coral/15 px-1 font-mono text-[9px] text-fr-coral">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function ValidationList() {
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const synthError = useSandboxStore((s) => s.synthError)

  if (synthError) {
    return (
      <div className="p-4">
        <div className="rounded-md border border-fr-rose/30 bg-fr-rose/5 p-3 font-mono text-[11.5px] text-fg whitespace-pre-wrap">
          {synthError}
        </div>
      </div>
    )
  }

  if (diagnostics.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <p className="font-mono text-[11px] text-fr-sage">
          No validation issues. Pipeline is ready to ship.
        </p>
      </div>
    )
  }

  return (
    <ul className="max-h-[260px] divide-y divide-dash-border/40 overflow-y-auto">
      {diagnostics.map((d, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-2 text-[11.5px]">
          <span
            className={
              d.severity === "error"
                ? "mt-0.5 size-2 shrink-0 rounded-full bg-fr-rose"
                : "mt-0.5 size-2 shrink-0 rounded-full bg-fr-amber"
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              <span
                className={
                  d.severity === "error" ? "text-fr-rose" : "text-fr-amber"
                }
              >
                {d.severity}
              </span>
              {d.componentName ? <span>· {d.componentName}</span> : null}
              {d.category ? <span>· {d.category}</span> : null}
            </div>
            <p className="mt-0.5 break-words text-fg">{d.message}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
