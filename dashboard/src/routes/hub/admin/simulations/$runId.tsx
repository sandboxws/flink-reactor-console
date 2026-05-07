/**
 * Hub simulation detail — /hub/admin/simulations/$runId.
 *
 * Renders the timeline of observations for one simulation run plus a
 * properties card (scenario, status, duration, parameters). Polling
 * picks up while the run is still RUNNING/PENDING; clears on
 * unmount.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { format, formatDistanceToNowStrict } from "date-fns"
import { AlertTriangle } from "lucide-react"
import { useEffect } from "react"
import { SimulationTimeline } from "@/components/hub/tools/simulations/simulation-timeline"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useSimulationStore } from "@/stores/simulation-store"

function HubSimulationDetail() {
  const { runId } = useParams({ from: "/hub/admin/simulations/$runId" })
  const fetchRun = useSimulationStore((s) => s.fetchRun)
  const startActivePolling = useSimulationStore((s) => s.startActivePolling)
  const stopActivePolling = useSimulationStore((s) => s.stopActivePolling)
  const clearActiveRun = useSimulationStore((s) => s.clearActiveRun)
  const activeRun = useSimulationStore((s) => s.activeRun)
  const error = useSimulationStore((s) => s.error)

  useEffect(() => {
    fetchRun(runId).then(() => {
      const r = useSimulationStore.getState().activeRun
      if (r && (r.status === "RUNNING" || r.status === "PENDING")) {
        startActivePolling(runId)
      }
    })
    return () => {
      stopActivePolling()
      clearActiveRun()
    }
  }, [runId, fetchRun, startActivePolling, stopActivePolling, clearActiveRun])

  if (!activeRun) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Tools" },
            { label: "Simulations", to: "/hub/admin/simulations" },
            { label: runId, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="mt-6 glass-card-static p-6 text-center">
          {error ? (
            <>
              <AlertTriangle className="mx-auto size-6 text-fr-rose" />
              <p className="mt-2 text-[12px] text-fg-muted">{error}</p>
            </>
          ) : (
            <p className="text-[12px] font-mono text-fg-faint">Loading run…</p>
          )}
        </div>
      </HubAppShell>
    )
  }

  const duration = activeRun.stoppedAt
    ? `${formatDistanceToNowStrict(new Date(activeRun.startedAt), {
        addSuffix: false,
      })} (ended)`
    : formatDistanceToNowStrict(new Date(activeRun.startedAt), {
        addSuffix: false,
      })

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Tools" },
          { label: "Simulations", to: "/hub/admin/simulations" },
          { label: activeRun.scenario, mono: true },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          {activeRun.scenario}
        </h1>
        <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
          {activeRun.id}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <div className="glass-card-static p-5">
            <h2 className="section-heading mb-4">Timeline</h2>
            <SimulationTimeline run={activeRun} />
          </div>
        </div>

        <div className="col-span-12 space-y-4 lg:col-span-4">
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Run properties</h3>
            <dl className="space-y-2 text-[12px]">
              <Row label="Status" value={activeRun.status} />
              <Row
                label="Started"
                value={format(new Date(activeRun.startedAt), "PP p")}
              />
              <Row
                label="Stopped"
                value={
                  activeRun.stoppedAt
                    ? format(new Date(activeRun.stoppedAt), "PP p")
                    : "—"
                }
              />
              <Row label="Duration" value={duration} />
              <Row
                label="Observations"
                value={String(activeRun.observations?.length ?? 0)}
              />
            </dl>
          </div>

          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Parameters</h3>
            {Object.keys(activeRun.parameters).length === 0 ? (
              <p className="text-[12px] text-fg-muted">No parameters.</p>
            ) : (
              <dl className="space-y-1.5 text-[11.5px]">
                {Object.entries(activeRun.parameters).map(([k, v]) => (
                  <Row key={k} label={k} value={String(v)} />
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </HubAppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-mono text-fg truncate">{value}</dd>
    </div>
  )
}

export const Route = createFileRoute("/hub/admin/simulations/$runId")({
  component: HubSimulationDetail,
})
