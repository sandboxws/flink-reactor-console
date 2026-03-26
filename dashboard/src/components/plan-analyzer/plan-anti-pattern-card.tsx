/**
 * @module plan-anti-pattern-card
 *
 * Card component for displaying a single {@link FlinkAntiPattern} detected in
 * the execution plan. Shows severity badge, description, actionable suggestion,
 * and optional code blocks for configuration fixes, DDL changes, or SQL rewrites.
 */

import { AlertTriangle, Copy, Info, OctagonAlert } from "lucide-react"
import { useCallback } from "react"
import { cn } from "@/lib/cn"
import type { FlinkAntiPattern } from "@/lib/plan-analyzer/types"

/** Severity-specific styling: border color, icon component, badge colors, and label text. */
const SEVERITY_STYLES = {
  critical: {
    border: "border-l-job-failed",
    icon: OctagonAlert,
    badge: "bg-job-failed/15 text-job-failed",
    label: "Critical",
  },
  warning: {
    border: "border-l-fr-amber",
    icon: AlertTriangle,
    badge: "bg-fr-amber/15 text-fr-amber",
    label: "Warning",
  },
  info: {
    border: "border-l-zinc-500",
    icon: Info,
    badge: "bg-zinc-500/15 text-zinc-400",
    label: "Info",
  },
} as const

/**
 * Displays a detected anti-pattern with severity indicator, description,
 * suggestion, and optional code blocks (config, DDL fix, SQL rewrite)
 * that can be copied to clipboard.
 */
export function PlanAntiPatternCard({
  antiPattern,
}: {
  antiPattern: FlinkAntiPattern
}) {
  const style = SEVERITY_STYLES[antiPattern.severity]
  const Icon = style.icon

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 border-l-2 bg-dash-elevated p-3",
        style.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200">
              {antiPattern.title}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium",
                style.badge,
              )}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            {antiPattern.description}
          </p>
        </div>
      </div>

      {/* Suggestion */}
      <div className="mt-2 rounded bg-dash-panel px-2.5 py-1.5 text-[11px] text-zinc-300">
        {antiPattern.suggestion}
      </div>

      {/* SQL / DDL fix */}
      {(antiPattern.flinkConfig ||
        antiPattern.ddlFix ||
        antiPattern.sqlRewrite) && (
        <div className="mt-2">
          {antiPattern.flinkConfig && (
            <CodeBlock
              label="Configuration"
              code={antiPattern.flinkConfig}
              onCopy={copyToClipboard}
            />
          )}
          {antiPattern.ddlFix && (
            <CodeBlock
              label="DDL Fix"
              code={antiPattern.ddlFix}
              onCopy={copyToClipboard}
            />
          )}
          {antiPattern.sqlRewrite && (
            <CodeBlock
              label="SQL Rewrite"
              code={antiPattern.sqlRewrite}
              onCopy={copyToClipboard}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Labeled code snippet with a copy-to-clipboard button. */
function CodeBlock({
  label,
  code,
  onCopy,
}: {
  label: string
  code: string
  onCopy: (text: string) => void
}) {
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onCopy(code)}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Copy className="size-3" />
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto rounded bg-fr-bg p-2 text-[10px] leading-relaxed text-zinc-300">
        {code}
      </pre>
    </div>
  )
}
