/**
 * @module failure-label-chips
 *
 * Renders FLIP-304 failure labels as compact key/value chips. Chips wrap; when
 * there are more than `max`, the overflow collapses into a "+N" chip whose title
 * lists the hidden labels. Renders nothing when there are no labels, so
 * unenriched exceptions look exactly as they did before.
 *
 * Styling is intentionally neutral (key dim, value emphasized) — the console
 * mirrors what Flink's enrichers report and does not re-classify labels.
 */

import type { FailureLabel } from "@flink-reactor/ui"

/** A single key/value failure-label chip. */
function LabelChip({ label }: { label: FailureLabel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-dash-elevated px-2 py-0.5 text-[10px] leading-none ring-1 ring-inset ring-dash-border">
      <span className="text-zinc-500">{label.key}</span>
      <span className="font-medium text-zinc-300">{label.value}</span>
    </span>
  )
}

/**
 * Failure-label chip row. Shows up to `max` chips (default 4); any remaining
 * labels collapse into a "+N" chip. Returns null when `labels` is empty/absent.
 */
export function FailureLabelChips({
  labels,
  max = 4,
}: {
  labels?: FailureLabel[]
  max?: number
}) {
  if (!labels || labels.length === 0) return null

  const visible = labels.slice(0, max)
  const overflow = labels.slice(max)

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((label) => (
        <LabelChip key={`${label.key}=${label.value}`} label={label} />
      ))}
      {overflow.length > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-dash-elevated px-2 py-0.5 text-[10px] leading-none text-zinc-400 ring-1 ring-inset ring-dash-border"
          title={overflow.map((l) => `${l.key}: ${l.value}`).join("\n")}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  )
}
