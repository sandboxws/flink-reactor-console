import type { BlueGreenDeployment } from "../types"

export function createBlueGreenDeployment(overrides?: Partial<BlueGreenDeployment>): BlueGreenDeployment {
  return {
    name: "ecommerce-pipeline",
    namespace: "flink-prod",
    state: "ACTIVE_BLUE",
    jobStatus: "RUNNING",
    error: null,
    lastReconciledTimestamp: new Date().toISOString(),
    abortTimestamp: null,
    deploymentReadyTimestamp: new Date(Date.now() - 86_400_000).toISOString(),
    blueDeploymentName: "ecommerce-pipeline-blue",
    greenDeploymentName: "ecommerce-pipeline-green",
    activeJobId: "job-001",
    pendingJobId: null,
    abortGracePeriod: "PT5M",
    deploymentDeletionDelay: "PT1M",
    ...overrides,
  }
}
