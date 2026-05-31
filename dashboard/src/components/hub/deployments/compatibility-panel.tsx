/**
 * State-compatibility panel for the deployment-detail and registry-detail views.
 *
 * Renders a verdict banner (Compatible / Warnings / Incompatible), the
 * can-proceed gate, and the per-operator issue list. This is the Tier-2
 * advisory surface — the authoritative block happens in the CLI `deploy`
 * preflight (state-collision-01); the console annotates, it does not gate the
 * Flink operator.
 */

import { EmptyState, SevBadge } from "@flink-reactor/ui"
import { Ban, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"
import { CompatibilityIssueList } from "@/components/hub/deployments/compatibility-issue-list"
import type { CompatibilityReport } from "@/data/compatibility-types"
import { verdictLabel, verdictTone } from "@/data/compatibility-types"

interface CompatibilityPanelProps {
  report: CompatibilityReport | null
  loading: boolean
  error: string | null
}

export function CompatibilityPanel({
  report,
  loading,
  error,
}: CompatibilityPanelProps) {
  if (loading && !report) {
    return <div className="h-24 animate-pulse rounded bg-dash-surface/40" />
  }
  if (error) {
    return (
      <div className="rounded border border-fr-coral/30 bg-dash-surface p-4 text-[12px] text-fr-coral">
        Failed to load compatibility report: {error}
      </div>
    )
  }
  if (!report) {
    return (
      <EmptyState
        icon={ShieldQuestion}
        message="No compatibility check recorded yet for this pipeline."
      />
    )
  }

  const VerdictIcon =
    report.verdict === "COMPATIBLE"
      ? ShieldCheck
      : report.verdict === "WARNING"
        ? ShieldAlert
        : Ban

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-dash-surface p-3">
        <div className="flex items-center gap-2.5">
          <VerdictIcon className="size-4 text-fg-muted" />
          <SevBadge tone={verdictTone(report.verdict)}>
            {verdictLabel(report.verdict)}
          </SevBadge>
          {report.canProceed ? (
            <span className="text-[11px] text-fg-muted">
              deploy may proceed
            </span>
          ) : (
            <span className="text-[11px] font-medium text-fr-coral">
              deploy blocked — restore would fail
            </span>
          )}
        </div>
        {report.checkedAt ? (
          <span className="font-mono text-[10px] text-fg-faint">
            checked {new Date(report.checkedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {report.issues.length > 0 ? (
        <CompatibilityIssueList issues={report.issues} />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          message="No state-incompatible changes detected between the last two versions."
        />
      )}
    </div>
  )
}
