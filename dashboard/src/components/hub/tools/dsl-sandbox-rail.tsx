/**
 * DSL editor RIGHT pane — Validation, Simulate, Last simulation, AI assist.
 *
 * Mirrors `console-v2/sandbox.html` lines 232-285. Validation cards are
 * driven by `useSandboxStore.diagnostics`; "Simulate" is a placeholder
 * that links to `/hub/admin/simulations` (the actual run is built in
 * §3 of P4); "AI assist" is a static stub.
 */

import { Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Sparkles,
} from "lucide-react"
import { useSandboxStore } from "@/stores/sandbox-store"

export function DslSandboxRail() {
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const status = useSandboxStore((s) => s.status)
  const synthError = useSandboxStore((s) => s.synthError)
  const synthTimeMs = useSandboxStore((s) => s.synthTimeMs)
  const pipelines = useSandboxStore((s) => s.pipelines)

  const errors = diagnostics.filter((d) => d.severity === "error")
  const warnings = diagnostics.filter((d) => d.severity === "warning")
  const compiles = !synthError && errors.length === 0 && status === "done"

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-dash-border bg-dash-surface/30 px-3 py-4">
      <h3 className="section-heading mb-2">Validation</h3>
      <div className="mb-5 space-y-2">
        {compiles ? (
          <RailCard tone="sage" icon={CheckCircle2} title="Compiles">
            DSL parsed in {synthTimeMs ?? 0}ms · {pipelines.length} stage
            {pipelines.length === 1 ? "" : "s"} · 0 errors
          </RailCard>
        ) : null}
        {synthError ? (
          <RailCard tone="rose" icon={AlertTriangle} title="Synthesis error">
            <span className="break-words">{synthError}</span>
          </RailCard>
        ) : null}
        {errors.map((d, i) => (
          <RailCard
            key={`e-${i}`}
            tone="rose"
            icon={AlertTriangle}
            title={`Error · ${d.componentName ?? d.category ?? "DSL"}`}
          >
            <span className="break-words">{d.message}</span>
          </RailCard>
        ))}
        {warnings.map((d, i) => (
          <RailCard
            key={`w-${i}`}
            tone="amber"
            icon={AlertTriangle}
            title={`Warning · ${d.componentName ?? d.category ?? "DSL"}`}
          >
            <span className="break-words">{d.message}</span>
          </RailCard>
        ))}
        {compiles && diagnostics.length === 0 ? null : null}
        {status === "idle" ? (
          <p className="rounded border border-dash-border bg-fr-bg/40 p-3 font-mono text-[11px] text-fg-faint">
            Type DSL to see validation.
          </p>
        ) : null}
      </div>

      <h3 className="section-heading mb-2">Simulate</h3>
      <div className="mb-5 rounded border border-dash-border bg-fr-bg/40 p-3">
        <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
          <SimStat label="Mode" value="dry-run" />
          <SimStat label="Records" value="1k" />
          <SimStat label="Speed" value="10×" />
        </div>
        <Link
          to="/hub/admin/simulations"
          className="btn btn-secondary btn-sm w-full justify-center"
        >
          <FlaskConical className="size-3.5" />
          Run simulation
        </Link>
      </div>

      <h3 className="section-heading mb-2">AI assist</h3>
      <div className="rounded border border-dash-border bg-fr-bg/40 p-3 text-[11.5px]">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-fr-purple" />
          <span className="font-medium text-fr-purple">Suggestion</span>
        </div>
        <p className="text-fg-muted leading-relaxed">
          Wire up your DSL on the left, then ask the assistant to review for
          common pitfalls — fallback paths, missing watermarks, oversized
          windows.
        </p>
        <p className="mt-2 font-mono text-[10px] text-fg-faint">
          (placeholder — AI assist ships in a follow-up)
        </p>
      </div>
    </aside>
  )
}

function RailCard({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "sage" | "amber" | "rose"
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  const titleClass =
    tone === "sage"
      ? "text-fr-sage"
      : tone === "rose"
        ? "text-fr-rose"
        : "text-fr-amber"
  return (
    <div className="rounded border border-dash-border bg-fr-bg/40 p-3 text-[11.5px]">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={`size-3.5 ${titleClass}`} />
        <span className={`font-medium ${titleClass}`}>{title}</span>
      </div>
      <p className="leading-relaxed text-fg-muted">{children}</p>
    </div>
  )
}

function SimStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
        {label}
      </div>
      <div className="mt-1 font-mono text-fg">{value}</div>
    </div>
  )
}
