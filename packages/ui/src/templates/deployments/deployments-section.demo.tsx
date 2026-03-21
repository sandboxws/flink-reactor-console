"use client"

import { createBlueGreenDeployment } from "../../fixtures"
import { DeploymentsSection } from "./deployments-section"

const deployments = [
  createBlueGreenDeployment(),
  createBlueGreenDeployment({
    name: "analytics-pipeline",
    namespace: "flink-staging",
    state: "TRANSITIONING_TO_GREEN",
    activeJobId: "job-003",
    pendingJobId: "job-004",
  }),
  createBlueGreenDeployment({
    name: "fraud-detection",
    namespace: "flink-prod",
    state: "SAVEPOINTING_BLUE",
    activeJobId: "job-005",
  }),
]

export function DeploymentsSectionDemo() {
  return (
    <div className="max-w-5xl rounded-lg border border-dash-border bg-dash-surface">
      <DeploymentsSection
        deployments={deployments}
        onSelect={(name) => console.log("selected deployment", name)}
      />
    </div>
  )
}
