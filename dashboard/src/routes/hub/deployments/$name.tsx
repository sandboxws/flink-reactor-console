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
import {
  ArrowLeftRight,
  CircleX,
  History,
  Layers,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { gql } from "urql"
import { BlueGreenComparison } from "@/components/hub/deployments/blue-green-comparison"
import { CompatibilityPanel } from "@/components/hub/deployments/compatibility-panel"
import { ManifestVersionHistory } from "@/components/hub/deployments/manifest-version-history"
import { RestoreTimeline } from "@/components/hub/deployments/restore-timeline"
import { StateMachineViz } from "@/components/hub/deployments/state-machine-viz"
import { getStateLabel } from "@/data/bg-deployment-types"
import { graphqlClient } from "@/lib/graphql-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"
import { useCompatibilityStore } from "@/stores/compatibility-store"

const CONFIG_DIFF_QUERY = gql`
  query BlueGreenDeploymentConfigDiff(
    $name: String!
    $namespace: String
    $cluster: String
  ) {
    blueGreenDeploymentConfigDiff(
      name: $name
      namespace: $namespace
      cluster: $cluster
    ) {
      blueYAML
      greenYAML
    }
  }
`

interface ConfigDiffState {
  blueYAML: string
  greenYAML: string
  loading: boolean
  error: string | null
}

function HubDeploymentDetail() {
  const { name } = useParams({ from: "/hub/deployments/$name" })
  const fetchDeployments = useBgDeploymentStore((s) => s.fetchDeployments)
  const deployments = useBgDeploymentStore((s) => s.deployments)
  const error = useBgDeploymentStore((s) => s.error)

  // State-compatibility detail for this pipeline (pipeline name == deployment
  // name under the FlinkReactor naming contract). Fetched once per name; the
  // store runs report + versions + restores in parallel.
  const report = useCompatibilityStore((s) => s.report)
  const versions = useCompatibilityStore((s) => s.versions)
  const restores = useCompatibilityStore((s) => s.restores)
  const detailLoading = useCompatibilityStore((s) => s.detailLoading)
  const detailError = useCompatibilityStore((s) => s.detailError)
  const fetchPipelineDetail = useCompatibilityStore(
    (s) => s.fetchPipelineDetail,
  )

  useEffect(() => {
    fetchDeployments()
    const id = setInterval(() => fetchDeployments(), 5000)
    return () => clearInterval(id)
  }, [fetchDeployments])

  useEffect(() => {
    fetchPipelineDetail(name)
  }, [name, fetchPipelineDetail])

  const deployment = useMemo(
    () => deployments.find((d) => d.name === name) ?? null,
    [deployments, name],
  )

  const [configDiff, setConfigDiff] = useState<ConfigDiffState>({
    blueYAML: "",
    greenYAML: "",
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    setConfigDiff((prev) => ({ ...prev, loading: true, error: null }))
    graphqlClient
      .query(CONFIG_DIFF_QUERY, { name })
      .toPromise()
      .then((result) => {
        if (cancelled) return
        if (result.error) {
          setConfigDiff({
            blueYAML: "",
            greenYAML: "",
            loading: false,
            error: result.error.message,
          })
          return
        }
        const diff = result.data?.blueGreenDeploymentConfigDiff
        setConfigDiff({
          blueYAML: diff?.blueYAML ?? "",
          greenYAML: diff?.greenYAML ?? "",
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setConfigDiff({
          blueYAML: "",
          greenYAML: "",
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load diff",
        })
      })
    return () => {
      cancelled = true
    }
  }, [name])

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

      {/* State compatibility */}
      <section className="glass-card-static p-5 mb-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <ShieldCheck className="size-3.5" />
          State compatibility
        </h3>
        <CompatibilityPanel
          report={report}
          loading={detailLoading}
          error={detailError}
        />
      </section>

      {/* State manifest history */}
      <section className="glass-card-static p-5 mb-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <Layers className="size-3.5" />
          State manifest history
        </h3>
        <ManifestVersionHistory
          versions={versions}
          loading={detailLoading}
          error={detailError}
        />
      </section>

      {/* Restore outcomes */}
      <section className="glass-card-static p-5 mb-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <History className="size-3.5" />
          Restore outcomes
        </h3>
        <RestoreTimeline
          restores={restores}
          loading={detailLoading}
          error={detailError}
        />
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
        <ConfigDiffSection state={configDiff} />
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

function ConfigDiffSection({ state }: { state: ConfigDiffState }) {
  if (state.loading) {
    return <div className="h-40 animate-pulse rounded bg-dash-surface/40" />
  }
  if (state.error) {
    return (
      <div className="rounded border border-fr-coral/30 bg-dash-surface p-4 text-[12px] text-fr-coral">
        Failed to load config diff: {state.error}
      </div>
    )
  }
  if (!state.blueYAML && !state.greenYAML) {
    return (
      <div className="rounded bg-dash-surface p-4 text-[12px] text-fg-muted">
        No template configuration found for this deployment.
      </div>
    )
  }
  if (!state.greenYAML) {
    return (
      <div className="space-y-3">
        <div className="rounded bg-dash-surface p-3 text-[11px] text-fg-muted">
          No pending green — showing the active blue configuration only.
        </div>
        <DiffViewer a={state.blueYAML} b={state.blueYAML} />
      </div>
    )
  }
  return <DiffViewer a={state.blueYAML} b={state.greenYAML} />
}

export const Route = createFileRoute("/hub/deployments/$name")({
  component: HubDeploymentDetail,
})
