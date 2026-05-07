/**
 * Hub simulations list — /hub/admin/simulations.
 *
 * Reads runs + presets from `useSimulationStore`. Shows a header with
 * preset chips (clickable to run), an active-run banner, and a list of
 * recent runs with throughput sparklines + outcome badges. Drill into a
 * run via `/hub/admin/simulations/$runId`.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Activity, AlertTriangle, Play } from "lucide-react"
import { useEffect } from "react"
import { SimulationRunRow } from "@/components/hub/tools/simulations/simulation-run-row"
import { SimulationTimeline } from "@/components/hub/tools/simulations/simulation-timeline"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useSimulationStore } from "@/stores/simulation-store"

function HubSimulations() {
  const initialize = useSimulationStore((s) => s.initialize)
  const runs = useSimulationStore((s) => s.runs)
  const presets = useSimulationStore((s) => s.presets)
  const activeRun = useSimulationStore((s) => s.activeRun)
  const runSimulation = useSimulationStore((s) => s.runSimulation)
  const stopActivePolling = useSimulationStore((s) => s.stopActivePolling)
  const error = useSimulationStore((s) => s.error)
  const isLoading = useSimulationStore((s) => s.isLoading)

  useEffect(() => {
    initialize()
    return () => stopActivePolling()
  }, [initialize, stopActivePolling])

  const isLive =
    activeRun?.status === "RUNNING" || activeRun?.status === "PENDING"

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Tools" }, { label: "Simulations" }]}
        LinkComponent={HubLink}
      />
      <div className="mt-1 mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Simulations
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Run pre-canned chaos scenarios against the cluster, then inspect the
            resulting observation timeline.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 text-[12px] text-fg">
          <AlertTriangle className="mt-0.5 size-3.5 text-fr-rose" />
          <span className="font-mono">{error}</span>
        </div>
      ) : null}

      {isLive && activeRun ? (
        <section className="glass-card-static mb-6 p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-fr-sage" />
            <h2 className="font-sans text-[14px] font-medium text-zinc-100">
              Live run · {activeRun.scenario}
            </h2>
          </div>
          <SimulationTimeline run={activeRun} />
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="section-heading mb-3">Presets</h2>
        {presets.length === 0 ? (
          <p className="text-[12px] font-mono text-fg-faint">
            {isLoading ? "Loading…" : "No presets registered."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.scenario}
                type="button"
                disabled={isLive}
                onClick={() =>
                  runSimulation({
                    scenario: p.scenario,
                    parameters: p.defaultParameters,
                  })
                }
                className="glass-card-static flex items-start gap-3 p-3 text-left text-[12px] transition-colors hover:border-fr-coral/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="mt-0.5 size-3.5 shrink-0 text-fr-coral" />
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-fg-muted line-clamp-2">
                    {p.description}
                  </div>
                  <span className="mt-1.5 inline-block font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                    {p.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-heading mb-3">Recent runs</h2>
        {runs.length === 0 ? (
          <div className="glass-card-static p-8 text-center">
            <Activity className="mx-auto size-6 text-fr-coral/60" />
            <p className="mt-3 text-[12px] text-fg-muted">
              No simulations have been run yet. Start a preset above.
            </p>
          </div>
        ) : (
          <div className="glass-card-static divide-y divide-dash-border/40 overflow-hidden">
            {runs.map((run) => (
              <SimulationRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/admin/simulations/")({
  component: HubSimulations,
})
