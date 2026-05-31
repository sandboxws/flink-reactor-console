/**
 * Hub deployments — /hub/deployments.
 *
 * 5-column Linear-style kanban (Pending / Validating / Rolling out /
 * Rolling back / Complete) backed by `useBgDeploymentStore`. The store
 * polls every ~5s; column counts update without a page reload as
 * deployments transition state.
 *
 * The "Add deployment" footer is non-functional in v1 — clicking it
 * surfaces a banner directing to the CLI per the design doc.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Filter, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { DeploymentKanban } from "@/components/hub/deployments/deployment-kanban"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"
import { useCompatibilityStore } from "@/stores/compatibility-store"

function HubDeployments() {
  const fetchDeployments = useBgDeploymentStore((s) => s.fetchDeployments)
  const deployments = useBgDeploymentStore((s) => s.deployments)
  const isLoading = useBgDeploymentStore((s) => s.isLoading)
  const error = useBgDeploymentStore((s) => s.error)
  const fetchSummaries = useCompatibilityStore((s) => s.fetchSummaries)
  const summaries = useCompatibilityStore((s) => s.summaries)
  const [showAddBanner, setShowAddBanner] = useState(false)

  useEffect(() => {
    fetchDeployments()
    fetchSummaries()
    const id = setInterval(() => {
      fetchDeployments()
      fetchSummaries()
    }, 5000)
    return () => clearInterval(id)
  }, [fetchDeployments, fetchSummaries])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Deployments" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Deployments
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {deployments.length} deployment
            {deployments.length === 1 ? "" : "s"}
            {isLoading ? " · refreshing…" : " · live"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm">
            <Filter />
            Triage
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchDeployments()}
          >
            <RefreshCw />
            Refresh
          </button>
        </div>
      </div>

      {showAddBanner ? (
        <div className="glass-card-static mb-4 p-3 text-[12px] text-fg">
          Use the FlinkReactor CLI to deploy:{" "}
          <code className="font-mono">
            flink-reactor deploy --bluegreen ...
          </code>
          <button
            type="button"
            className="ml-3 text-[10px] font-mono text-fg-faint hover:text-fr-coral"
            onClick={() => setShowAddBanner(false)}
          >
            DISMISS
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          Failed to load deployments: {error}
        </div>
      ) : (
        <DeploymentKanban
          deployments={deployments}
          summaries={summaries}
          onAdd={() => setShowAddBanner(true)}
        />
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/deployments/")({
  component: HubDeployments,
})
