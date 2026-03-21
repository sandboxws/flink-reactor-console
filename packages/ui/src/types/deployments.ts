/**
 * Domain types for FlinkBlueGreenDeployment resources.
 */

export type BlueGreenState =
  | "INITIALIZING_BLUE"
  | "ACTIVE_BLUE"
  | "ACTIVE_GREEN"
  | "SAVEPOINTING_BLUE"
  | "SAVEPOINTING_GREEN"
  | "TRANSITIONING_TO_BLUE"
  | "TRANSITIONING_TO_GREEN"

export interface BlueGreenDeployment {
  readonly name: string
  readonly namespace: string
  readonly state: BlueGreenState
  readonly jobStatus: string | null
  readonly error: string | null
  readonly lastReconciledTimestamp: string | null
  readonly abortTimestamp: string | null
  readonly deploymentReadyTimestamp: string | null
  readonly blueDeploymentName: string | null
  readonly greenDeploymentName: string | null
  readonly activeJobId: string | null
  readonly pendingJobId: string | null
  readonly abortGracePeriod: string | null
  readonly deploymentDeletionDelay: string | null
}

/** State badge color mapping */
export type StateBadgeColor = "green" | "amber" | "blue" | "gray"
