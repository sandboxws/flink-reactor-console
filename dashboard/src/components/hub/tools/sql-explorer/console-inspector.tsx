/**
 * Right-hand inspector for the SQL console.
 *
 * For a selected statement that launched a Flink job, the primary action opens
 * the Console's own job-detail view (`/hub/jobs/$id`) — not the stock Flink Web
 * UI. Live job state is read from the cluster store and shown as a StatePill.
 */

import { EmptyState, StatePill, type StatePillState } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { ArrowUpRight, Check, Copy, ListTree } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/cn"
import type { StatementResult } from "@/stores/catalog-explore-store"
import { useClusterStore } from "@/stores/cluster-store"

/** Map a Flink job status to a deployment-style StatePill state + label. */
function jobStatusToPill(status: string): {
  state: StatePillState
  label: string
} {
  switch (status) {
    case "RUNNING":
    case "RESTARTING":
    case "RECONCILING":
      return { state: "active", label: status }
    case "FINISHED":
      return { state: "done", label: status }
    case "FAILED":
    case "FAILING":
      return { state: "failed", label: status }
    default:
      // CREATED, CANCELED, CANCELLING, SUSPENDED
      return { state: "pending", label: status }
  }
}

interface ConsoleInspectorProps {
  statement: StatementResult | null
  sessionHandle: string | null
}

export function ConsoleInspector({
  statement,
  sessionHandle,
}: ConsoleInspectorProps) {
  const runningJobs = useClusterStore((s) => s.runningJobs)

  if (!statement) {
    return (
      <div className="flex h-full min-h-0 flex-col border-l border-dash-border bg-dash-surface/30">
        <InspectorHeader />
        <EmptyState
          icon={ListTree}
          message="Select a result to inspect the job it launched."
        />
      </div>
    )
  }

  const liveJob = statement.jobId
    ? runningJobs.find((j) => j.id === statement.jobId)
    : undefined
  const pill = liveJob
    ? jobStatusToPill(liveJob.status)
    : statement.status === "running"
      ? { state: "active" as const, label: "RUNNING" }
      : null

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-dash-border bg-dash-surface/30">
      <InspectorHeader pill={pill} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <Section title="Identity">
          {statement.jobId ? (
            <Field label="Job ID" value={statement.jobId} copyable />
          ) : null}
          {sessionHandle ? (
            <Field label="Session" value={sessionHandle} />
          ) : null}
          <Field label="Statement" value={statement.sql.replace(/\s+/g, " ")} />
        </Section>

        {statement.jobId ? (
          <>
            <Section title="Open in Console">
              <Link
                to="/hub/jobs/$id"
                params={{ id: statement.jobId }}
                className="btn btn-secondary btn-sm w-full justify-center"
              >
                <ArrowUpRight className="size-3.5" />
                Open job in Console
              </Link>
            </Section>
            <Section title="Actions">
              <CopyButton text={statement.jobId} label="Copy job id" />
            </Section>
          </>
        ) : (
          <p className="font-mono text-[11px] leading-relaxed text-fg-faint">
            This statement did not launch a Flink job
            {statement.rowCount > 0
              ? ` — it returned ${statement.rowCount} row${statement.rowCount === 1 ? "" : "s"}.`
              : "."}
          </p>
        )}
      </div>
    </div>
  )
}

function InspectorHeader({
  pill,
}: {
  pill?: { state: StatePillState; label: string } | null
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-dash-border px-4">
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
        Inspector
      </span>
      {pill ? <StatePill state={pill.state}>{pill.label}</StatePill> : null}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="section-heading">{title}</p>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  copyable,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[9.5px] uppercase tracking-wider text-fg-faint">
        {label}
      </p>
      {copyable ? (
        <CopyableText text={value} />
      ) : (
        <p className="break-all font-mono text-[11px] text-fg-muted">{value}</p>
      )}
    </div>
  )
}

function useCopy(text: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return [copied, copy]
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, copy] = useCopy(text)
  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-ghost btn-sm w-full justify-center"
    >
      {copied ? (
        <Check className="size-3.5 text-job-running" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {label}
    </button>
  )
}

function CopyableText({ text }: { text: string }) {
  const [copied, copy] = useCopy(text)
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={cn(
        "group flex w-full items-center gap-1.5 text-left font-mono text-[11px] text-fg-muted transition-colors hover:text-fg",
      )}
    >
      <span className="break-all">{text}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-job-running" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}
