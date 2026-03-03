"use client"

import { format } from "date-fns"
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { StackTrace } from "@/components/errors/stack-trace"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { JobException } from "@/data/cluster-types"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------
// Collapsible stacktrace wrapper (reuses shared StackTrace component)
// ---------------------------------------------------------------------------

function StacktraceViewer({
  exception,
  defaultOpen,
}: {
  exception: JobException
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        {open ? "Hide stacktrace" : "Show stacktrace"}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <StackTrace raw={exception.stacktrace} />
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Exception card
// ---------------------------------------------------------------------------

function ExceptionCard({
  exception,
  isRootCause,
}: {
  exception: JobException
  isRootCause?: boolean
}) {
  return (
    <div
      className={cn(
        "glass-card p-4",
        isRootCause && "border border-job-failed/20 bg-job-failed/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isRootCause && (
              <AlertTriangle className="size-3.5 shrink-0 text-job-failed" />
            )}
            <h4 className="truncate text-xs font-medium text-zinc-200">
              {exception.name}
            </h4>
          </div>
          <p className="mt-1 text-xs text-zinc-400">{exception.message}</p>
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-zinc-600">
          {format(exception.timestamp, "HH:mm:ss")}
        </span>
      </div>

      {/* Task attribution */}
      {exception.location && (
        <div className="mt-2 text-[10px] text-zinc-500">
          Source: <span className="text-zinc-400">{exception.location}</span>
        </div>
      )}

      <div className="mt-3">
        <StacktraceViewer exception={exception} defaultOpen={isRootCause} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExceptionsTab
// ---------------------------------------------------------------------------

export function ExceptionsTab({ exceptions }: { exceptions: JobException[] }) {
  if (exceptions.length === 0) {
    return <EmptyState icon={CheckCircle} message="No exceptions recorded" />
  }

  const [rootCause, ...history] = exceptions

  return (
    <div className="flex flex-col gap-4">
      {/* Root cause */}
      <div>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Root Cause
        </h3>
        <ExceptionCard exception={rootCause} isRootCause />
      </div>

      {/* Exception history */}
      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Exception History
          </h3>
          <div className="flex flex-col gap-2">
            {history.map((ex, i) => (
              <ExceptionCard
                key={`${ex.timestamp.getTime()}-${i}`}
                exception={ex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
