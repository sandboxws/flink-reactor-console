/** Display constants for the plan analyzer UI. */

import type { ShuffleStrategy } from "../types/plan-analyzer"

/** Human-readable labels for each data shuffle strategy. */
export const SHUFFLE_STRATEGY_LABELS: Record<ShuffleStrategy, string> = {
  FORWARD: "Forward (1:1)",
  HASH: "Hash Partition",
  REBALANCE: "Round-Robin",
  BROADCAST: "Broadcast",
  RESCALE: "Local Rescale",
  GLOBAL: "Global (Single)",
  CUSTOM: "Custom",
  UNKNOWN: "Unknown",
}
