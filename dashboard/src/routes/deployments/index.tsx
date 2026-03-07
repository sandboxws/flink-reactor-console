import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { DeploymentsTable } from "@/components/deployments/deployments-table"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"

export const Route = createFileRoute("/deployments/")({
  component: Deployments,
})

function Deployments() {
  const deployments = useBgDeploymentStore((s) => s.deployments)
  const isLoading = useBgDeploymentStore((s) => s.isLoading)
  const fetchError = useBgDeploymentStore((s) => s.fetchError)
  const fetchDeployments = useBgDeploymentStore((s) => s.fetchDeployments)

  useEffect(() => {
    fetchDeployments()
  }, [fetchDeployments])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">
          Blue-Green Deployments
        </h1>
        <span className="text-xs tabular-nums text-zinc-500">
          {deployments.length}{" "}
          {deployments.length === 1 ? "deployment" : "deployments"}
        </span>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {fetchError}
        </div>
      )}

      {isLoading && deployments.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <span className="text-sm">Loading deployments...</span>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <DeploymentsTable deployments={deployments} />
        </div>
      )}
    </div>
  )
}
