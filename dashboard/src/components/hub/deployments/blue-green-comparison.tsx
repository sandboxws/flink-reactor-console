/**
 * Side-by-side blue/green comparison cards.
 *
 * Each card shows the side label (Blue / Green), the active flag, the job ID
 * (if any), and the configured deployment resource name. The "active" side
 * gets the sage tint; the inactive side renders dimmed.
 */

import { LiveDot } from "@flink-reactor/ui"
import type {
  BlueGreenDeployment,
  BlueGreenState,
} from "@/data/bg-deployment-types"

interface BlueGreenComparisonProps {
  deployment: BlueGreenDeployment
}

function activeSide(state: BlueGreenState): "blue" | "green" | null {
  if (state === "ACTIVE_BLUE" || state === "TRANSITIONING_TO_BLUE")
    return "blue"
  if (state === "ACTIVE_GREEN" || state === "TRANSITIONING_TO_GREEN")
    return "green"
  return null
}

export function BlueGreenComparison({ deployment }: BlueGreenComparisonProps) {
  const active = activeSide(deployment.state)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SideCard
        label="Blue"
        accent="text-fr-teal"
        active={active === "blue"}
        deploymentName={deployment.blueDeploymentName}
        jobId={
          active === "blue" ? deployment.activeJobId : deployment.pendingJobId
        }
      />
      <SideCard
        label="Green"
        accent="text-fr-sage"
        active={active === "green"}
        deploymentName={deployment.greenDeploymentName}
        jobId={
          active === "green" ? deployment.activeJobId : deployment.pendingJobId
        }
      />
    </div>
  )
}

function SideCard({
  label,
  accent,
  active,
  deploymentName,
  jobId,
}: {
  label: string
  accent: string
  active: boolean
  deploymentName: string | null
  jobId: string | null
}) {
  return (
    <div className={`glass-card-static p-4 ${active ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[12px] ${accent}`}>{label}</span>
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-fr-sage">
            <LiveDot />
            ACTIVE
          </span>
        ) : (
          <span className="font-mono text-[10px] text-fg-faint">STANDBY</span>
        )}
      </div>
      <dl className="space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Deployment</dt>
          <dd className="font-mono text-fg truncate">
            {deploymentName ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Job ID</dt>
          <dd className="font-mono text-fg truncate">
            {jobId ? jobId.slice(0, 12) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  )
}
