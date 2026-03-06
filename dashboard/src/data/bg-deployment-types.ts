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
