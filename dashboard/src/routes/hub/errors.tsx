/**
 * Hub error explorer — /hub/errors.
 *
 * Mirrors `console-v2/errors.html`. Reads exception groups from
 * `useErrorStore` (which auto-groups by exception class + message prefix
 * from log entries and live Flink exception history). Renders the
 * mockup's two-pane layout: groups list on the left, selected-group
 * detail (stack trace, occurrences sparkbar, affected sources) on the
 * right.
 *
 * Group sorting toggles between `lastSeen` and `count` to match the
 * mockup's "Last seen" vs "Highest count" expectations. Owner avatars
 * and resolution actions in the mockup are deferred — there is no
 * server-side ownership/resolution model today.
 */

import {
  HubBreadcrumb,
  KpiCard,
  PropChip,
  StatusIcon,
  type ErrorGroup,
  type StatusIconState,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  Download,
  Layers,
  Sliders,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useErrorStore } from "@/stores/error-store"
import { useLogStore } from "@/stores/log-store"

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "—"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Map a group's age + count to a status-icon state. Newer + frequent = firing. */
function groupState(g: ErrorGroup): StatusIconState {
  const minutesSinceLast = (Date.now() - g.lastSeen.getTime()) / 60000
  if (minutesSinceLast > 60) return "resolved"
  if (g.count >= 50) return "firing"
  if (g.count >= 5) return "acknowledged"
  return "in-progress"
}

type SortKey = "lastSeen" | "count" | "firstSeen"

function HubErrors() {
  const initialize = useClusterStore((s) => s.initialize)
  const startStreaming = useLogStore((s) => s.startStreaming)
  const stopStreaming = useLogStore((s) => s.stopStreaming)
  const startExceptionPoll = useErrorStore((s) => s.startLiveExceptionPolling)
  const stopExceptionPoll = useErrorStore((s) => s.stopLiveExceptionPolling)
  const groups = useErrorStore((s) => s.groups)
  const selectedGroupId = useErrorStore((s) => s.selectedGroupId)
  const selectGroup = useErrorStore((s) => s.selectGroup)

  const [sortKey, setSortKey] = useState<SortKey>("lastSeen")
  const [sortDesc, setSortDesc] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    initialize()
    startStreaming()
    startExceptionPoll()
    return () => {
      stopStreaming()
      stopExceptionPoll()
    }
  }, [
    initialize,
    startStreaming,
    stopStreaming,
    startExceptionPoll,
    stopExceptionPoll,
  ])

  const groupArray = useMemo(() => Array.from(groups.values()), [groups])

  const visibleGroups = useMemo(() => {
    const filtered = showResolved
      ? groupArray
      : groupArray.filter((g) => groupState(g) !== "resolved")
    const sorted = [...filtered].sort((a, b) => {
      let aV = 0
      let bV = 0
      switch (sortKey) {
        case "count":
          aV = a.count
          bV = b.count
          break
        case "firstSeen":
          aV = a.firstSeen.getTime()
          bV = b.firstSeen.getTime()
          break
        case "lastSeen":
        default:
          aV = a.lastSeen.getTime()
          bV = b.lastSeen.getTime()
          break
      }
      return sortDesc ? bV - aV : aV - bV
    })
    return sorted
  }, [groupArray, sortKey, sortDesc, showResolved])

  const selected = useMemo(
    () =>
      selectedGroupId
        ? groupArray.find((g) => g.id === selectedGroupId)
        : null,
    [selectedGroupId, groupArray],
  )

  // KPIs derived from the full group set (not the filtered view).
  const totalOccurrences = groupArray.reduce((s, g) => s + g.count, 0)
  const affectedSources = new Set<string>()
  for (const g of groupArray)
    for (const s of g.affectedSources) affectedSources.add(s.id)
  const firstSeenLastHour = groupArray.filter(
    (g) => Date.now() - g.firstSeen.getTime() < 60 * 60 * 1000,
  ).length

  return (
    <HubAppShell>
      {/* ── Header ─────────────────────────────────────────────── */}
      <HubBreadcrumb crumbs={[{ label: "Errors" }]} LinkComponent={HubLink} />
      <div className="mt-1 mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Error explorer
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {groupArray.length} unique exception group
            {groupArray.length === 1 ? "" : "s"} ·{" "}
            {totalOccurrences.toLocaleString()} occurrence
            {totalOccurrences === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled
            aria-label="Filter (not implemented)"
          >
            <Sliders />
            Filter
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled
            aria-label="Export CSV (not implemented)"
          >
            <Download />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Unique exceptions" value={groupArray.length} />
        <KpiCard
          label="Total occurrences"
          value={totalOccurrences.toLocaleString()}
        />
        <KpiCard
          label="Affected sources"
          value={affectedSources.size}
          sub="TM/JM combined"
        />
        <KpiCard
          label="First-seen (last hour)"
          value={
            <span className={firstSeenLastHour > 0 ? "text-fr-coral" : ""}>
              {firstSeenLastHour}
            </span>
          }
          sub={firstSeenLastHour > 0 ? "watch closely" : "no new groups"}
        />
      </section>

      {/* ── Filter chip bar ────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PropChip active icon={Layers}>
          All sources
        </PropChip>
        <PropChip icon={CalendarClock}>Last 24h</PropChip>
        <PropChip icon={Sliders}>Group by exception</PropChip>
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className={`prop-chip ${showResolved ? "active" : ""}`}
        >
          <CheckCircle2 className="size-3.5" />
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSortKey((k) =>
                k === "lastSeen" ? "count" : k === "count" ? "firstSeen" : "lastSeen",
              )
            }}
          >
            <ArrowUpDown />
            sort: {sortKey}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDesc((v) => !v)}
          >
            {sortDesc ? "desc" : "asc"}
          </button>
        </div>
      </div>

      {/* ── 2-pane layout ──────────────────────────────────────── */}
      {visibleGroups.length === 0 ? (
        <div className="glass-card-static p-12 text-center">
          <CheckCircle2 className="mx-auto size-6 text-fr-sage" />
          <h2 className="mt-3 text-[14px] font-medium text-zinc-100">
            All clear
          </h2>
          <p className="mt-1 text-[12px] text-fg-muted">
            No exception groups in the current window.
            {!showResolved
              ? " (Resolved groups are hidden — toggle the chip to view them.)"
              : ""}
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-12 gap-5">
          {/* Group list */}
          <div className={selected ? "col-span-12 xl:col-span-7" : "col-span-12"}>
            <div className="glass-card-static overflow-hidden">
              <div className="grid grid-cols-[36px_1fr_120px_120px_60px] items-center gap-3 border-b border-dash-border px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
                <span>Sev</span>
                <span>Exception · source</span>
                <span className="text-right">Occurrences</span>
                <span className="text-right">Last seen</span>
                <span className="text-right">Hosts</span>
              </div>
              {visibleGroups.map((g) => {
                const state = groupState(g)
                const isSelected = selected?.id === g.id
                const accent =
                  state === "firing"
                    ? "text-fr-rose"
                    : state === "acknowledged"
                      ? "text-fr-amber"
                      : state === "resolved"
                        ? "text-fr-sage"
                        : "text-fg-muted"
                const className =
                  "grid grid-cols-[36px_1fr_120px_120px_60px] items-center gap-3 border-b border-dash-border/40 px-4 py-3 hover:bg-dash-elevated/30 cursor-pointer text-left w-full"
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => selectGroup(g.id)}
                    className={className}
                    style={
                      isSelected
                        ? { background: "rgba(231,138,78,0.08)" }
                        : state === "firing"
                          ? { background: "rgba(231,138,78,0.04)" }
                          : undefined
                    }
                  >
                    <StatusIcon state={state} />
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] text-fg truncate">
                        <span className={accent}>{g.exceptionClass}</span>
                        {g.message ? `: ${g.message}` : ""}
                      </div>
                      <div className="mt-0.5 text-[11px] text-fg-muted truncate">
                        {g.affectedSources[0]?.label ?? "unknown source"}
                        {g.affectedSources.length > 1
                          ? ` · +${g.affectedSources.length - 1} more`
                          : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-[13px] ${state === "firing" ? "text-fr-rose font-semibold" : "text-fg"}`}
                      >
                        {g.count}
                      </div>
                      <div className="font-mono text-[10px] text-fg-faint">
                        {state === "resolved" ? "resolved" : "active"}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <div className="text-fg">{timeAgo(g.lastSeen)} ago</div>
                      <div className="text-fg-faint">
                        first {timeAgo(g.firstSeen)} ago
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-fg-muted">
                      {g.affectedSources.length}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-fg-faint font-mono">
              <span>
                Showing {visibleGroups.length} of {groupArray.length} groups
              </span>
              <span>
                {showResolved ? "all states" : "active only"} · sort: {sortKey}{" "}
                {sortDesc ? "desc" : "asc"}
              </span>
            </div>
          </div>

          {/* Detail panel */}
          {selected ? (
            <aside className="col-span-12 xl:col-span-5 space-y-4">
              <ErrorDetailCard
                group={selected}
                onClose={() => selectGroup(null)}
              />
            </aside>
          ) : null}
        </section>
      )}
    </HubAppShell>
  )
}

function ErrorDetailCard({
  group,
  onClose,
}: {
  group: ErrorGroup
  onClose: () => void
}) {
  const state = groupState(group)
  const sevTone =
    state === "firing"
      ? "fail"
      : state === "acknowledged"
        ? "warn"
        : state === "resolved"
          ? "ok"
          : "info"

  // Sparkbar bins: 24 hourly bins of group occurrences (newest on right).
  const bins = useMemo(() => {
    const buckets = new Array(24).fill(0)
    const now = Date.now()
    for (const t of group.occurrences) {
      const hoursAgo = Math.floor((now - t.getTime()) / (60 * 60 * 1000))
      if (hoursAgo >= 0 && hoursAgo < 24) buckets[23 - hoursAgo]++
    }
    return buckets
  }, [group.occurrences])
  const maxBin = Math.max(1, ...bins)

  return (
    <div className="glass-card-static p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon state={state} />
          <span className="font-mono text-[11px] text-fg-faint">
            {group.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`sev-badge ${sevTone}`}>{state}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Close detail"
          >
            <X />
          </button>
        </div>
      </div>
      <h3 className="font-mono text-[14px] text-fg leading-relaxed break-words">
        {group.exceptionClass}
        {group.message ? `: ${group.message}` : ""}
      </h3>

      <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
        <DetailKV label="First seen" value={`${timeAgo(group.firstSeen)} ago`} />
        <DetailKV label="Last seen" value={`${timeAgo(group.lastSeen)} ago`} />
        <DetailKV label="Hosts" value={`${group.affectedSources.length}`} />
      </div>

      <div className="my-4 border-t border-dash-border" />

      <div className="text-[10px] font-mono uppercase tracking-wider text-fg-faint mb-2">
        Occurrences (last 24h)
      </div>
      <div className="sparkbar">
        {bins.map((count, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional bucket
            key={i}
            className={count === 0 ? "skip" : count > maxBin / 2 ? "fail" : "run"}
            style={{ height: `${(count / maxBin) * 100}%`, opacity: count === 0 ? 0.3 : 0.9 }}
            title={`${23 - i}h ago: ${count}`}
          />
        ))}
      </div>

      <div className="my-4 border-t border-dash-border" />

      <div className="text-[10px] font-mono uppercase tracking-wider text-fg-faint mb-2">
        Affected sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.affectedSources.map((s) => (
          <span
            key={s.id}
            className="rounded bg-dash-elevated/60 px-2 py-0.5 font-mono text-[10.5px] text-fg-muted border border-dash-border"
          >
            {s.label}
          </span>
        ))}
      </div>

      {group.sampleEntry.stackTrace ? (
        <>
          <div className="my-4 border-t border-dash-border" />
          <div className="text-[10px] font-mono uppercase tracking-wider text-fg-faint mb-2">
            Stack trace
          </div>
          <pre className="rounded bg-fr-bg/60 p-2.5 font-mono text-[11px] leading-relaxed text-fg-muted overflow-x-auto whitespace-pre max-h-72">
            {group.sampleEntry.stackTrace}
          </pre>
        </>
      ) : null}
    </div>
  )
}

function DetailKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-fg-faint font-mono uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 font-mono text-fg">{value}</div>
    </div>
  )
}

export const Route = createFileRoute("/hub/errors")({
  component: HubErrors,
})
