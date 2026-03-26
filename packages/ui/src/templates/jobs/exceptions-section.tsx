"use client"

/**
 * ExceptionsSection — Exception list with section header.
 *
 * Wraps the ExceptionsTab domain component with a header showing
 * the exception count and a severity indicator.
 *
 * Accepts pure data props — no stores, no router.
 */

import { AlertTriangle, CheckCircle } from "lucide-react"
import type { JobException } from "../../types"
import { ExceptionsTab } from "../../components/jobs/exceptions-tab"

/** Renders the exceptions section with exception list, severity indicator, and stack traces. */
export function ExceptionsSection({
  exceptions,
}: {
  exceptions: JobException[]
}) {
  const hasExceptions = exceptions.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-400">
        {hasExceptions ? (
          <AlertTriangle className="size-4 text-job-failed" />
        ) : (
          <CheckCircle className="size-4 text-job-running" />
        )}
        <h3 className="text-sm font-medium text-zinc-200">Exceptions</h3>
        {hasExceptions && (
          <span className="rounded-full bg-job-failed/15 px-2 py-0.5 text-[10px] font-medium text-job-failed">
            {exceptions.length}
          </span>
        )}
      </div>

      {/* Tab content */}
      <ExceptionsTab exceptions={exceptions} />
    </div>
  )
}
