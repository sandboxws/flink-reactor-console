/**
 * Hub DSL editor pane — CodeMirror 6 (Gruvpuccin theme) wrapped in
 * Hub-styled chrome (header strip + section heading). Reuses the legacy
 * `SandboxEditor` for the actual editor surface so we get TSX/JSX support,
 * DSL autocompletion, diagnostic gutter, and palette-aware theming for
 * free.
 *
 * Reads/writes editor state from `useSandboxStore`; debounced synthesis
 * is triggered automatically by `SandboxEditor`.
 */

import { Play } from "lucide-react"
import { SandboxEditor } from "@/components/sandbox/sandbox-editor"
import { TemplatePicker } from "@/components/sandbox/template-picker"
import { useSandboxStore } from "@/stores/sandbox-store"

export function DslEditorPane() {
  const code = useSandboxStore((s) => s.code)
  const setCode = useSandboxStore((s) => s.setCode)
  const synthesize = useSandboxStore((s) => s.synthesize)
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const activeTemplate = useSandboxStore((s) => s.activeTemplate)
  const setTemplate = useSandboxStore((s) => s.setTemplate)
  const status = useSandboxStore((s) => s.status)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-dash-border bg-dash-surface/40 px-4">
        <div className="flex items-center gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
            DSL editor
          </h3>
          <TemplatePicker value={activeTemplate} onSelect={setTemplate} />
        </div>
        <button
          type="button"
          onClick={synthesize}
          disabled={status === "synthesizing"}
          className="btn btn-secondary btn-sm"
        >
          <Play className="size-3" />
          {status === "synthesizing" ? "Synthesizing…" : "Synthesize"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SandboxEditor
          value={code}
          onChange={setCode}
          onSynthesize={synthesize}
          diagnostics={diagnostics}
        />
      </div>
    </div>
  )
}
