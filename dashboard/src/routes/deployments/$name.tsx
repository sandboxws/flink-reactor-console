import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { DeploymentCard } from "@/components/deployments/deployment-card"
import { StateBadge } from "@/components/deployments/state-badge"
import { StateMachine } from "@/components/deployments/state-machine"
import { useBgDeploymentStore } from "@/stores/bg-deployment-store"

/** Route: /deployments/$name — Deployment detail with state machine visualization, blue/green cards, and configuration. */
export const Route = createFileRoute("/deployments/$name")({
  component: DeploymentDetail,
})

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  )
}

function DeploymentDetail() {
  const { name } = Route.useParams()
  const deployment = useBgDeploymentStore((s) => s.selectedDeployment)
  const isLoading = useBgDeploymentStore((s) => s.selectedDeploymentLoading)
  const error = useBgDeploymentStore((s) => s.selectedDeploymentError)
  const fetchDeployment = useBgDeploymentStore((s) => s.fetchDeployment)

  useEffect(() => {
    fetchDeployment(name)
  }, [fetchDeployment, name])

  if (isLoading && !deployment) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <span className="text-sm">Loading deployment...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!deployment) return null

  const isBlueActive =
    deployment.state === "ACTIVE_BLUE" ||
    deployment.state === "SAVEPOINTING_BLUE"
  const isGreenActive =
    deployment.state === "ACTIVE_GREEN" ||
    deployment.state === "SAVEPOINTING_GREEN"

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">
          {deployment.name}
        </h1>
        <StateBadge state={deployment.state} />
      </div>

      {/* Error banner */}
      {deployment.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {deployment.error}
        </div>
      )}

      {/* State machine visualization */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Lifecycle State Machine
        </h2>
        <StateMachine currentState={deployment.state} />
      </div>

      {/* Blue/Green deployment cards */}
      <div className="grid grid-cols-2 gap-4">
        <DeploymentCard
          label="Blue"
          deploymentName={deployment.blueDeploymentName}
          jobId={
            isBlueActive ? deployment.activeJobId : deployment.pendingJobId
          }
          jobStatus={isBlueActive ? deployment.jobStatus : null}
          isActive={isBlueActive}
        />
        <DeploymentCard
          label="Green"
          deploymentName={deployment.greenDeploymentName}
          jobId={
            isGreenActive ? deployment.activeJobId : deployment.pendingJobId
          }
          jobStatus={isGreenActive ? deployment.jobStatus : null}
          isActive={isGreenActive}
        />
      </div>

      {/* Configuration panel */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Configuration
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <ConfigRow label="Namespace" value={deployment.namespace} />
            <ConfigRow
              label="Abort Grace Period"
              value={deployment.abortGracePeriod ?? "default"}
            />
            <ConfigRow
              label="Deletion Delay"
              value={deployment.deploymentDeletionDelay ?? "default"}
            />
          </div>
          <div className="space-y-2">
            <ConfigRow
              label="Last Reconciled"
              value={deployment.lastReconciledTimestamp ?? "-"}
            />
            <ConfigRow
              label="Deployment Ready"
              value={deployment.deploymentReadyTimestamp ?? "-"}
            />
            {deployment.abortTimestamp && (
              <ConfigRow
                label="Abort Timestamp"
                value={deployment.abortTimestamp}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
