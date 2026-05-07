/**
 * Empty state for the alerts page when zero rules trip and zero are
 * acknowledged. Renders the "All clear" check-icon variant.
 */

import { CheckCircle2 } from "lucide-react"

interface AlertEmptyStateProps {
  /** Total enabled rules being evaluated, used to confirm the engine ran. */
  enabledRuleCount: number
}

export function AlertEmptyState({ enabledRuleCount }: AlertEmptyStateProps) {
  return (
    <div className="glass-card-static p-12 text-center">
      <CheckCircle2 className="mx-auto size-10 text-fr-sage" />
      <p className="mt-3 text-[14px] font-medium text-zinc-100">All clear</p>
      <p className="mt-1 text-[12px] font-mono text-fg-muted">
        no alerts firing · {enabledRuleCount} rule
        {enabledRuleCount === 1 ? "" : "s"} active
      </p>
    </div>
  )
}
