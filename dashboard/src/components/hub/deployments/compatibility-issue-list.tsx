/**
 * Per-operator compatibility issue list. Each row names the operator
 * (logicalKey), its component, a category badge, and the remediation message.
 *
 * No colored left-border accents (Hub rule #1) — severity is conveyed via the
 * SevBadge pill and a subtle surface tint.
 */

import { SevBadge } from "@flink-reactor/ui"
import type { CompatibilityIssue } from "@/data/compatibility-types"
import { categoryLabel, severityTone } from "@/data/compatibility-types"

interface CompatibilityIssueListProps {
  issues: readonly CompatibilityIssue[]
}

export function CompatibilityIssueList({
  issues,
}: CompatibilityIssueListProps) {
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li
          key={`${issue.operatorKey}-${issue.category}-${issue.message}`}
          className="rounded-md bg-dash-surface p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[12px] text-zinc-100">
              {issue.operatorKey}
            </code>
            <SevBadge tone="muted">{issue.component}</SevBadge>
            <SevBadge tone={severityTone(issue.severity)}>
              {categoryLabel(issue.category)}
            </SevBadge>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
            {issue.message}
          </p>
        </li>
      ))}
    </ul>
  )
}
