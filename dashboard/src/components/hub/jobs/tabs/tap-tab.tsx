/**
 * Hub Tap tab — thin Hub-styled wrapper around the legacy {@link TapPanel}.
 *
 * Restyling the panel internals (operator dropdown, results table, controls)
 * is intentionally deferred to a follow-up. The panel is 400+ LOC of streaming
 * SQL Gateway logic; this tab ships the missing feature first.
 *
 * Visibility is gated by the parent route via `useTapStore` selectors — see
 * `/hub/jobs/$id.tsx` for the `hasTapManifest` check.
 */

import { Radio } from "lucide-react"
import { TapPanel } from "@/components/tap/tap-panel"

export function HubTapTab({ jobName }: { jobName: string }) {
  return (
    <div className="glass-card-static p-4">
      <div className="mb-3 flex items-center justify-between border-b border-dash-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-fr-coral" />
          <h3 className="font-sans text-[13px] font-medium text-zinc-100">
            Live observation
          </h3>
        </div>
        <span className="font-mono text-[10px] text-fg-faint">
          pipeline: <span className="text-fg-muted">{jobName}</span>
        </span>
      </div>
      <TapPanel jobName={jobName} />
    </div>
  )
}
