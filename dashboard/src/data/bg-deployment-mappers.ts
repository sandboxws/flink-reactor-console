/**
 * Pure mapper functions: GraphQL response → BlueGreenDeployment domain types.
 */
import type { BlueGreenDeployment, BlueGreenState } from "./bg-deployment-types"

// GraphQL response shape (from codegen)
interface GqlBlueGreenDeployment {
  name: string
  namespace: string
  state: string
  jobStatus: string | null
  error: string | null
  lastReconciledTimestamp: string | null
  abortTimestamp: string | null
  deploymentReadyTimestamp: string | null
  blueDeploymentName: string | null
  greenDeploymentName: string | null
  activeJobId: string | null
  pendingJobId: string | null
  abortGracePeriod: string | null
  deploymentDeletionDelay: string | null
}

const VALID_STATES = new Set<string>([
  "INITIALIZING_BLUE",
  "ACTIVE_BLUE",
  "ACTIVE_GREEN",
  "SAVEPOINTING_BLUE",
  "SAVEPOINTING_GREEN",
  "TRANSITIONING_TO_BLUE",
  "TRANSITIONING_TO_GREEN",
])

function mapState(raw: string): BlueGreenState {
  if (VALID_STATES.has(raw)) return raw as BlueGreenState
  return "INITIALIZING_BLUE"
}

export function mapBlueGreenDeployment(
  raw: GqlBlueGreenDeployment,
): BlueGreenDeployment {
  return {
    name: raw.name,
    namespace: raw.namespace,
    state: mapState(raw.state),
    jobStatus: raw.jobStatus,
    error: raw.error,
    lastReconciledTimestamp: raw.lastReconciledTimestamp,
    abortTimestamp: raw.abortTimestamp,
    deploymentReadyTimestamp: raw.deploymentReadyTimestamp,
    blueDeploymentName: raw.blueDeploymentName,
    greenDeploymentName: raw.greenDeploymentName,
    activeJobId: raw.activeJobId,
    pendingJobId: raw.pendingJobId,
    abortGracePeriod: raw.abortGracePeriod,
    deploymentDeletionDelay: raw.deploymentDeletionDelay,
  }
}

export function mapBlueGreenDeployments(
  raw: GqlBlueGreenDeployment[],
): BlueGreenDeployment[] {
  return raw.map(mapBlueGreenDeployment)
}
