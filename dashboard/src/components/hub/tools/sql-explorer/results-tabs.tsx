/**
 * Per-statement results pane for the multi-statement SQL console.
 *
 * Renders a tab strip (`#1 0.4s`, `#2 0.9s`…) — one tab per executed statement,
 * each with a status dot and wall-clock duration — over the active statement's
 * result table (or its error). Status is conveyed by dots, never left-borders.
 */

import { cn } from "@/lib/cn"
import type { StatementResult } from "@/stores/catalog-explore-store"

type StStatus = StatementResult["status"]

/** Static class strings (Tailwind cannot generate templated names). */
const STATUS_DOT: Record<StStatus, string> = {
  idle: "bg-fg-faint",
  submitting: "bg-job-created",
  running: "bg-job-running animate-pulse",
  completed: "bg-job-finished",
  failed: "bg-job-failed",
  cancelled: "bg-job-cancelled",
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—"
  return `${(ms / 1000).toFixed(1)}s`
}

interface ResultsTabsProps {
  statements: StatementResult[]
  activeIndex: number
  status: StStatus
  error: string | null
  onSelect: (index: number) => void
}

export function ResultsTabs({
  statements,
  activeIndex,
  status,
  error,
  onSelect,
}: ResultsTabsProps) {
  if (statements.length === 0) {
    if (error) return <ErrorBlock error={error} />
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-mono text-[11px] text-fg-faint">
          {status === "submitting"
            ? "Submitting…"
            : "⌘⏎ run statement · ⌘⇧⏎ run all"}
        </p>
      </div>
    )
  }

  const active = statements[activeIndex] ?? statements[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-dash-border px-2">
        {statements.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            title={s.sql.replace(/\s+/g, " ")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] transition-colors",
              i === activeIndex
                ? "bg-dash-elevated/60 text-fg"
                : "text-fg-faint hover:bg-dash-hover/40 hover:text-fg-muted",
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", STATUS_DOT[s.status])}
            />
            <span>#{i + 1}</span>
            <span className="text-fg-faint/70">
              {fmtDuration(s.durationMs)}
            </span>
          </button>
        ))}
      </div>
      <ActiveResult statement={active} />
    </div>
  )
}

function ActiveResult({ statement }: { statement: StatementResult }) {
  if (statement.status === "failed" && statement.error) {
    return <ErrorBlock error={statement.error} />
  }
  // Render the table as soon as rows/columns arrive — including while still
  // "running" — so a streaming query ticks in live instead of appearing only
  // when it terminates. Only show the spinner before the first page lands.
  const hasData = statement.columns.length > 0 || statement.rows.length > 0
  if (!hasData) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-mono text-[11px] text-fg-faint">
          {statement.status === "running" || statement.status === "submitting"
            ? "Running…"
            : statement.status === "idle"
              ? "Queued…"
              : "No rows returned."}
        </p>
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResultMeta statement={statement} />
      {statement.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="font-mono text-[11px] text-fg-faint">
            No rows returned.
          </p>
        </div>
      ) : (
        <ResultTable columns={statement.columns} rows={statement.rows} />
      )}
    </div>
  )
}

function ResultMeta({ statement }: { statement: StatementResult }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-dash-border px-4">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        Statement {statement.index + 1} · {statement.rowCount} row
        {statement.rowCount === 1 ? "" : "s"}
        {statement.jobId ? " · job" : ""}
      </span>
      <span
        className="truncate font-mono text-[10px] text-fg-faint/60"
        title={statement.sql.replace(/\s+/g, " ")}
      >
        {statement.sql.replace(/\s+/g, " ")}
      </span>
    </div>
  )
}

function ResultTable({
  columns,
  rows,
}: {
  columns: { name: string; dataType: string }[]
  rows: (string | null)[][]
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-dash-surface">
          <tr className="border-b border-dash-border text-left text-fg-faint">
            {columns.map((c) => (
              <th
                key={c.name}
                className="whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-wider"
              >
                {c.name}
                <span className="ml-1 normal-case text-fg-faint/70">
                  {c.dataType}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border/40">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-dash-elevated/30">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="whitespace-nowrap px-3 py-1.5 font-mono text-[11.5px] text-fg"
                >
                  {cell ?? <span className="text-fg-faint">NULL</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="whitespace-pre-wrap rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 font-mono text-[11.5px] text-fg">
        {error}
      </div>
    </div>
  )
}
