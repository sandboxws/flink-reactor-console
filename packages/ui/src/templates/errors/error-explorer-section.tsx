"use client"

import { AlertCircle } from "lucide-react"
import { ErrorDetail } from "../../components/errors/error-detail"
import { EmptyState } from "../../shared/empty-state"
import type { ErrorGroup } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ErrorExplorerSectionProps {
  errors: ErrorGroup[]
  onViewLogs?: (errorId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Renders the error explorer section with grouped error details and log navigation. */
export function ErrorExplorerSection({
  errors,
  onViewLogs,
}: ErrorExplorerSectionProps) {
  if (errors.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        message="No errors detected."
      />
    )
  }

  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">
          Error Groups
        </h2>
        <span className="rounded-full bg-job-failed/15 px-2 py-0.5 text-[10px] font-medium text-job-failed">
          {errors.length} group{errors.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {errors.map((group) => (
          <div
            key={group.id}
            className="rounded-lg border border-white/5 bg-dash-elevated"
          >
            <ErrorDetail
              group={group}
              onViewRelatedLogs={
                onViewLogs
                  ? () => onViewLogs(group.id)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </section>
  )
}
