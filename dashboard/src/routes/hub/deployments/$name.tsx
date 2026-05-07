/**
 * Hub deployment detail — /hub/deployments/$name.
 *
 * Mirrors `console-v2/deployment.html`: blue/green comparison cards, config
 * diff via `<DiffViewer>`, state-machine pill strip, and action buttons
 * (Approve / Rollback / Revert). The diff is served straight from
 * `<DiffViewer>` — no left-border accents (background tint only).
 */

import { DiffViewer, HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { ArrowLeftRight, CircleX, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo } from "react"
import { BlueGreenComparison } from "@/components/hub/deployments/blue-green-comparison"
import { StateMachineViz } from "@/components/hub/deployments/state-machine-viz"
import { getStateLabel } from "@/data/bg-deployment-types"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"

function HubDeploymentDetail() {
  const { name } = useParams({ from: "/hub/deployments/$name" })
  const fetchDeployments = useBgDeploymentStore((s) => s.fetchDeployments)
  const deployments = useBgDeploymentStore((s) => s.deployments)
  const error = useBgDeploymentStore((s) => s.error)

  useEffect(() => {
    fetchDeployments()
    const id = setInterval(() => fetchDeployments(), 5000)
    return () => clearInterval(id)
  }, [fetchDeployments])

  const deployment = useMemo(
    () => deployments.find((d) => d.name === name) ?? null,
    [deployments, name],
  )

  // Synthesize a blue/green config diff for the diff-viewer demo. Without a
  // backend endpoint that returns both rendered configs we fall back to a
  // representative pair of YAML blobs derived from the deployment's tracked
  // resource names. This still exercises `<DiffViewer>` end-to-end.
  const { blueConfig, greenConfig } = useMemo(() => {
    if (!deployment) return { blueConfig: "", greenConfig: "" }
    const blue = `name: ${deployment.blueDeploymentName ?? `${deployment.name}-blue`}
namespace: ${deployment.namespace}
parallelism: 4
checkpointInterval: 60s
restartStrategy: fixedDelay
sources:
  - kafka:events.v1
sinks:
  - paimon:default.events`
    const green = `name: ${deployment.greenDeploymentName ?? `${deployment.name}-green`}
namespace: ${deployment.namespace}
parallelism: 8
checkpointInterval: 30s
restartStrategy: exponentialDelay
sources:
  - kafka:events.v2
sinks:
  - paimon:default.events`
    return { blueConfig: blue, greenConfig: green }
  }, [deployment])

  if (error) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Deployments", to: "/hub/deployments" },
            { label: name, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose mt-4">
          Failed to load deployment: {error}
        </div>
      </HubAppShell>
    )
  }

  if (!deployment) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Deployments", to: "/hub/deployments" },
            { label: name, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="glass-card-static p-6 text-center text-[12px] text-fg-muted mt-4">
          Deployment <code className="font-mono">{name}</code> not found.
        </div>
      </HubAppShell>
    )
  }

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Deployments", to: "/hub/deployments" },
          { label: deployment.name, mono: true },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            {deployment.name}
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            namespace <code className="font-mono">{deployment.namespace}</code>{" "}
            · state{" "}
            <span className="font-mono text-fg">
              {getStateLabel(deployment.state)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm">
            <Play />
            Approve
          </button>
          <button type="button" className="btn btn-ghost btn-sm">
            <RotateCcw />
            Rollback
          </button>
          <button type="button" className="btn btn-ghost btn-sm">
            <CircleX />
            Revert
          </button>
        </div>
      </div>

      {/* State machine */}
      <section className="glass-card-static p-5 mb-5">
        <h3 className="section-heading mb-3">Lifecycle</h3>
        <StateMachineViz
          state={deployment.state}
          abortTimestamp={deployment.abortTimestamp}
        />
        {deployment.error ? (
          <p className="mt-3 text-[12px] text-fr-coral font-mono">
            {deployment.error}
          </p>
        ) : null}
      </section>

      {/* Blue/green */}
      <section className="mb-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <ArrowLeftRight className="size-3.5" />
          Blue / green
        </h3>
        <BlueGreenComparison deployment={deployment} />
      </section>

      {/* Config diff */}
      <section className="glass-card-static p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-sans text-[14px] font-medium text-zinc-100">
              Config diff
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              blue → green · added lines sage, removed coral
            </p>
          </div>
        </div>
        <DiffViewer a={blueConfig} b={greenConfig} />
      </section>

      {/* Timing */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KvCard
          label="Last reconciled"
          value={deployment.lastReconciledTimestamp ?? "—"}
        />
        <KvCard
          label="Deployment ready"
          value={deployment.deploymentReadyTimestamp ?? "—"}
        />
        <KvCard
          label="Abort grace period"
          value={deployment.abortGracePeriod ?? "—"}
        />
      </section>
    </HubAppShell>
  )
}

function KvCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="font-mono text-[12px] text-fg truncate">{value}</div>
    </div>
  )
}

export const Route = createFileRoute("/hub/deployments/$name")({
  component: HubDeploymentDetail,
})
