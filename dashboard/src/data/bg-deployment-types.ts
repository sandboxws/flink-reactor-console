/**
 * Domain types for FlinkBlueGreenDeployment resources.
 *
 * Defines the BlueGreenDeployment interface, state machine enum, and
 * helper functions for mapping state to UI badge colors and labels.
 *
 * @module
 */

/** Blue-green deployment state machine phases. */
export type BlueGreenState =
  | "INITIALIZING_BLUE"
  | "ACTIVE_BLUE"
  | "ACTIVE_GREEN"
  | "SAVEPOINTING_BLUE"
  | "SAVEPOINTING_GREEN"
  | "TRANSITIONING_TO_BLUE"
  | "TRANSITIONING_TO_GREEN"

/** A Flink blue-green deployment with state machine and job tracking metadata. */
export interface BlueGreenDeployment {
  /** Deployment resource name. */
  readonly name: string
  /** Kubernetes namespace. */
  readonly namespace: string
  /** Current state machine phase. */
  readonly state: BlueGreenState
  /** Status of the Flink job associated with this deployment, or null. */
  readonly jobStatus: string | null
  /** Error message if the deployment is in a failed state, or null. */
  readonly error: string | null
  /** ISO timestamp of the last successful reconciliation, or null. */
  readonly lastReconciledTimestamp: string | null
  /** ISO timestamp when an abort was triggered, or null. */
  readonly abortTimestamp: string | null
  /** ISO timestamp when the deployment became ready, or null. */
  readonly deploymentReadyTimestamp: string | null
  /** Name of the blue-side Flink deployment resource, or null. */
  readonly blueDeploymentName: string | null
  /** Name of the green-side Flink deployment resource, or null. */
  readonly greenDeploymentName: string | null
  /** Flink job ID of the currently active (serving) job, or null. */
  readonly activeJobId: string | null
  /** Flink job ID of the pending (transitioning) job, or null. */
  readonly pendingJobId: string | null
  /** Duration string for the abort grace period, or null. */
  readonly abortGracePeriod: string | null
  /** Duration string for the deployment deletion delay, or null. */
  readonly deploymentDeletionDelay: string | null
}

/** Badge color for a blue-green state indicator. */
export type StateBadgeColor = "green" | "amber" | "blue" | "gray"

/** Map a blue-green state to its corresponding badge color. */
export function getStateBadgeColor(state: BlueGreenState): StateBadgeColor {
  switch (state) {
    case "ACTIVE_BLUE":
    case "ACTIVE_GREEN":
      return "green"
    case "SAVEPOINTING_BLUE":
    case "SAVEPOINTING_GREEN":
      return "amber"
    case "TRANSITIONING_TO_BLUE":
    case "TRANSITIONING_TO_GREEN":
      return "blue"
    case "INITIALIZING_BLUE":
      return "gray"
  }
}

/** Map a blue-green state to its human-readable display label. */
export function getStateLabel(state: BlueGreenState): string {
  switch (state) {
    case "INITIALIZING_BLUE":
      return "Initializing"
    case "ACTIVE_BLUE":
      return "Active (Blue)"
    case "ACTIVE_GREEN":
      return "Active (Green)"
    case "SAVEPOINTING_BLUE":
      return "Savepointing Blue"
    case "SAVEPOINTING_GREEN":
      return "Savepointing Green"
    case "TRANSITIONING_TO_BLUE":
      return "Transitioning to Blue"
    case "TRANSITIONING_TO_GREEN":
      return "Transitioning to Green"
  }
}
