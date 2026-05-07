/**
 * Hub alerts — /hub/monitoring/alerts.
 *
 * Linear-style alert list with priority bars, status icons, filter chips, and
 * grouping. Backed by the existing client-side `useAlertsStore` rules engine
 * (no backend change). When zero rules are tripped, renders the dedicated
 * AlertEmptyState rather than empty whitespace.
 *
 * Mirrors `console-v2/alerts.html` end-to-end: KPI strip, filter rail, grouped
 * list with `.issue-row` / `.issue-group-header`. Server-side alerts persistence
 * is `fr-server-XX-alerts-engine`.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { BellOff, Filter, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AlertEmptyState } from "@/components/hub/alerts/alert-empty-state"
import {
  AlertFilterRail,
  type AlertSeverityFilter,
  type AlertStatusFilter,
} from "@/components/hub/alerts/alert-filter-rail"
import { AlertGroupHeader } from "@/components/hub/alerts/alert-group-header"
import { AlertRow } from "@/components/hub/alerts/alert-row"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import {
  type ActiveAlert,
  type AlertSeverity,
  useAlertsStore,
} from "@/stores/alerts-store"

type Group = {
  key: string
  state: "firing" | "acknowledged" | "in-progress" | "resolved" | "suppressed"
  label: string
  hint?: string
  hintTone?: "rose" | "coral" | "amber" | "muted" | "faint"
  alerts: ActiveAlert[]
}

const SEVERITY_TO_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical (P1)",
  warning: "Warning (P2)",
  info: "Info (P3)",
}

function HubMonitoringAlerts() {
  const initialize = useAlertsStore((s) => s.initialize)
  const stopListening = useAlertsStore((s) => s.stopListening)
  const activeAlerts = useAlertsStore((s) => s.activeAlerts)
  const rules = useAlertsStore((s) => s.rules)
  const acknowledgeAlert = useAlertsStore((s) => s.acknowledgeAlert)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>(null)
  const [severityFilter, setSeverityFilter] =
    useState<AlertSeverityFilter>(null)
  const [groupBy, setGroupBy] = useState<"status" | "severity">("status")
  const [sortDesc, setSortDesc] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    initialize()
    return () => stopListening()
  }, [initialize, stopListening])

  const filtered = useMemo(() => {
    const lower = search.toLowerCase()
    return activeAlerts
      .filter((a) => {
        if (lower) {
          const hit =
            a.message.toLowerCase().includes(lower) ||
            a.ruleName.toLowerCase().includes(lower) ||
            a.id.toLowerCase().includes(lower)
          if (!hit) return false
        }
        if (statusFilter === "firing" && a.acknowledged) return false
        if (statusFilter === "acknowledged" && !a.acknowledged) return false
        if (severityFilter && a.severity !== severityFilter) return false
        return true
      })
      .sort((a, b) => {
        const cmp = a.triggeredAt.getTime() - b.triggeredAt.getTime()
        return sortDesc ? -cmp : cmp
      })
  }, [activeAlerts, search, statusFilter, severityFilter, sortDesc])

  const groups: Group[] = useMemo(() => {
    if (groupBy === "status") {
      const firing = filtered.filter((a) => !a.acknowledged)
      const acknowledged = filtered.filter((a) => a.acknowledged)
      const result: Group[] = []
      if (firing.length > 0) {
        result.push({
          key: "firing",
          state: "firing",
          label: "Firing",
          hint: "requires action",
          hintTone: "coral",
          alerts: firing,
        })
      }
      if (acknowledged.length > 0) {
        result.push({
          key: "acknowledged",
          state: "acknowledged",
          label: "Acknowledged",
          hint: "work in progress",
          hintTone: "muted",
          alerts: acknowledged,
        })
      }
      return result
    }
    const bySev = new Map<AlertSeverity, ActiveAlert[]>()
    for (const a of filtered) {
      const list = bySev.get(a.severity) ?? []
      list.push(a)
      bySev.set(a.severity, list)
    }
    const order: AlertSeverity[] = ["critical", "warning", "info"]
    return order
      .filter((s) => (bySev.get(s)?.length ?? 0) > 0)
      .map<Group>((s) => ({
        key: s,
        state: "firing",
        label: SEVERITY_TO_LABEL[s],
        hint:
          s === "critical"
            ? "page now"
            : s === "warning"
              ? "needs attention"
              : "FYI",
        hintTone:
          s === "critical" ? "rose" : s === "warning" ? "coral" : "amber",
        alerts: bySev.get(s) ?? [],
      }))
  }, [filtered, groupBy])

  const firingCount = activeAlerts.filter((a) => !a.acknowledged).length
  const ackCount = activeAlerts.filter((a) => a.acknowledged).length
  const enabledRuleCount = rules.filter((r) => r.enabled).length

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Observe" }, { label: "Alerts" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Alerts
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {firingCount} firing · {ackCount} acknowledged · {enabledRuleCount}{" "}
            rule{enabledRuleCount === 1 ? "" : "s"} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm">
            <Filter />
            Triage
          </button>
          <button type="button" className="btn btn-ghost btn-sm">
            <BellOff />
            Silence
          </button>
          <button type="button" className="btn btn-primary btn-sm">
            <Plus />
            New rule
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Firing"
          state="firing"
          value={firingCount}
          tone="coral"
        />
        <KpiTile
          label="Acknowledged"
          state="acknowledged"
          value={ackCount}
          tone="amber"
        />
        <KpiTile
          label="Active rules"
          value={enabledRuleCount}
          sub={`${rules.length - enabledRuleCount} disabled`}
        />
        <KpiTile
          label="Total rules"
          value={rules.length}
          sub={`${rules.filter((r) => r.isPreset).length} preset`}
        />
      </section>

      {activeAlerts.length === 0 ? (
        <AlertEmptyState enabledRuleCount={enabledRuleCount} />
      ) : (
        <>
          <AlertFilterRail
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            severity={severityFilter}
            onSeverityChange={setSeverityFilter}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortDesc={sortDesc}
            onSortToggle={() => setSortDesc((v) => !v)}
          />

          {groups.length === 0 ? (
            <div className="glass-card-static p-8 text-center text-[12px] text-fg-muted">
              No alerts match the current filters.
            </div>
          ) : (
            <div className="glass-card-static overflow-hidden">
              {groups.map((g) => {
                const isCollapsed = collapsed[g.key] ?? false
                return (
                  <div key={g.key}>
                    <AlertGroupHeader
                      state={g.state}
                      label={g.label}
                      count={g.alerts.length}
                      hint={g.hint}
                      hintTone={g.hintTone}
                      collapsed={isCollapsed}
                      onToggle={() =>
                        setCollapsed((prev) => ({
                          ...prev,
                          [g.key]: !isCollapsed,
                        }))
                      }
                    />
                    {isCollapsed
                      ? null
                      : g.alerts.map((a) => (
                          <AlertRow
                            key={a.id}
                            alert={a}
                            onClick={() => {
                              if (!a.acknowledged) acknowledgeAlert(a.id)
                            }}
                          />
                        ))}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </HubAppShell>
  )
}

interface KpiTileProps {
  label: string
  value: number | string
  sub?: string
  state?: "firing" | "acknowledged"
  tone?: "coral" | "amber" | "sage"
}

function KpiTile({ label, value, sub, state, tone }: KpiTileProps) {
  const valueClass =
    tone === "coral"
      ? "text-fr-coral"
      : tone === "amber"
        ? "text-fr-amber"
        : tone === "sage"
          ? "text-fr-sage"
          : ""
  return (
    <div className="kpi-card">
      <div className="kpi-label flex items-center gap-1.5">
        {state ? (
          <span
            className={`status-icon ${state}`}
            style={{ width: 10, height: 10 }}
          />
        ) : null}
        {label}
      </div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  )
}

export const Route = createFileRoute("/hub/monitoring/alerts")({
  component: HubMonitoringAlerts,
})
