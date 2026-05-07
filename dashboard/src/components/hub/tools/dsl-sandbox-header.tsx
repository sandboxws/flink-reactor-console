/**
 * DSL editor page header — sticky bar above the 3-column workspace.
 *
 * Mirrors `console-v2/sandbox.html` lines 60-74: title + DSL version +
 * scratchpad name + parse-status pill on the left, action buttons on
 * the right. Submit/Compare are placeholders today (no backend hook yet);
 * Save scratch persists the editor content via `useSandboxStore` (already
 * autosaved to localStorage on every keystroke, so this button just
 * confirms the scratchpad name).
 */

import { BookmarkPlus, Copy, GitCompare, Rocket } from "lucide-react"
import { useSandboxStore } from "@/stores/sandbox-store"

interface DslSandboxHeaderProps {
  scratchName?: string
  dslVersion?: string
}

export function DslSandboxHeader({
  scratchName = "scratch.fr.ts",
  dslVersion = "0.4.2",
}: DslSandboxHeaderProps) {
  const status = useSandboxStore((s) => s.status)
  const synthError = useSandboxStore((s) => s.synthError)
  const diagnostics = useSandboxStore((s) => s.diagnostics)

  const errors = diagnostics.filter((d) => d.severity === "error").length
  const pillTone =
    synthError || errors > 0
      ? "failed"
      : status === "synthesizing"
        ? "active"
        : status === "done"
          ? "running"
          : "pending"
  const pillLabel = synthError
    ? "parse error"
    : errors > 0
      ? `${errors} errors`
      : status === "done"
        ? "parsed ✓"
        : status === "synthesizing"
          ? "parsing…"
          : "idle"

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-dash-border bg-fr-bg/95 px-6">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="font-sans text-[15px] font-medium text-zinc-100 shrink-0">
          DSL sandbox
        </h1>
        <span className="text-fg-faint shrink-0">·</span>
        <span className="font-mono text-[11px] text-fg-muted truncate">
          flink-reactor-dsl @<span className="text-fg">{dslVersion}</span> ·
          scratch <span className="text-fg">{scratchName}</span>
        </span>
        <span className={`status-pill ${pillTone} shrink-0`}>{pillLabel}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" className="btn btn-ghost btn-sm" disabled>
          <GitCompare className="size-3.5" />
          Compare prod
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <Copy className="size-3.5" />
          Copy as YAML
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <BookmarkPlus className="size-3.5" />
          Save scratch
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled>
          <Rocket className="size-3.5" />
          Submit · ⌘↵
        </button>
      </div>
    </div>
  )
}
