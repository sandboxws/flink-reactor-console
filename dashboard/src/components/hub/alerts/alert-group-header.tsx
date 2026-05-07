/**
 * Linear-style alert group divider.
 *
 * Mirrors `console-v2/alerts.html .issue-group-header`. Includes a chevron
 * (open/closed), a status icon glyph, the group title, the count, and an
 * optional right-aligned hint.
 */

import { StatusIcon, type StatusIconState } from "@flink-reactor/ui"
import { ChevronDown, ChevronRight } from "lucide-react"

interface AlertGroupHeaderProps {
  state: StatusIconState
  label: string
  count: number
  hint?: string
  hintTone?: "rose" | "coral" | "amber" | "muted" | "faint"
  collapsed?: boolean
  onToggle?: () => void
}

const TONE_CLASSES = {
  rose: "text-fr-rose",
  coral: "text-fr-coral",
  amber: "text-fr-amber",
  muted: "text-fg-muted",
  faint: "text-fg-faint",
} as const

export function AlertGroupHeader({
  state,
  label,
  count,
  hint,
  hintTone = "muted",
  collapsed,
  onToggle,
}: AlertGroupHeaderProps) {
  const Chevron = collapsed ? ChevronRight : ChevronDown
  return (
    <button
      type="button"
      className="issue-group-header w-full text-left"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <Chevron className="text-fg-faint size-3.5" />
      <StatusIcon state={state} />
      <span className={state === "resolved" ? "text-fg-muted" : "text-fg"}>
        {label}
      </span>
      <span className="font-mono text-fg-faint">{count}</span>
      {hint ? (
        <span
          className={`ml-auto font-mono text-[11px] ${TONE_CLASSES[hintTone]}`}
        >
          {hint}
        </span>
      ) : null}
    </button>
  )
}
