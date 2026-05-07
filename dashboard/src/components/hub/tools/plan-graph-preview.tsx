/**
 * Hub plan-graph preview — renders the live synthesis output from
 * `useSandboxStore` next to the DSL editor. Status, diagnostics, and the
 * synthesized SQL/CRD/Plan are all sourced from the existing
 * `<SynthesisOutput>` and `<ValidationPanel>` components so we don't
 * duplicate synthesis chrome.
 */

import { Spinner } from "@flink-reactor/ui"
import { AlertTriangle, FileWarning } from "lucide-react"
import { SynthesisOutput } from "@/components/sandbox/synthesis-output"
import { ValidationPanel } from "@/components/sandbox/validation-panel"
import { useSandboxStore } from "@/stores/sandbox-store"

export function PlanGraphPreview() {
  const status = useSandboxStore((s) => s.status)
  const synthError = useSandboxStore((s) => s.synthError)
  const dslLoading = useSandboxStore((s) => s.dslLoading)
  const pipelines = useSandboxStore((s) => s.pipelines)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-dash-border bg-dash-surface/40 px-4">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
          Plan preview
        </h3>
        <Status
          status={status}
          dslLoading={dslLoading}
          count={pipelines.length}
        />
      </div>

      {synthError ? <SynthErrorBanner message={synthError} /> : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <SynthesisOutput focusComponents={null} />
      </div>
      <ValidationPanel />
    </div>
  )
}

function Status({
  status,
  dslLoading,
  count,
}: {
  status: ReturnType<typeof useSandboxStore.getState>["status"]
  dslLoading: boolean
  count: number
}) {
  if (dslLoading || status === "synthesizing") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fg-faint">
        <Spinner size="sm" />
        {dslLoading ? "Loading DSL runtime…" : "Synthesizing…"}
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fr-rose">
        <AlertTriangle className="size-3" />
        Error
      </span>
    )
  }
  if (status === "done") {
    return (
      <span className="font-mono text-[10.5px] text-fr-sage">
        {count} pipeline{count === 1 ? "" : "s"} · ready
      </span>
    )
  }
  return (
    <span className="font-mono text-[10.5px] text-fg-faint">
      Idle — type DSL above
    </span>
  )
}

function SynthErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-fr-rose/25 bg-fr-rose/5 px-4 py-2">
      <FileWarning className="mt-0.5 size-3.5 shrink-0 text-fr-rose" />
      <p className="font-mono text-[11px] leading-relaxed text-fg break-words">
        {message}
      </p>
    </div>
  )
}
