/**
 * Derive the StatusIcon state for an exception group.
 *
 * Only two states are derivable without backend signals:
 *  - `firing`: the group has occurred recently (not stale).
 *  - `suppressed`: no occurrences in the last 24h.
 *
 * The other StatusIcon states (`acknowledged`, `in-progress`, `resolved`,
 * `silenced`) all imply human action or a backend lifecycle we don't
 * track yet. Using them off heuristic count thresholds is misleading
 * (e.g. labelling a 15-count group "acknowledged" when nobody acked it).
 */

import type { ErrorGroup, StatusIconState } from "@flink-reactor/ui"

export function groupState(g: ErrorGroup): StatusIconState {
  return isStale(g) ? "suppressed" : "firing"
}

/** A group with no occurrences in 24h — eligible for the optional "Hide stale" filter. */
export function isStale(g: ErrorGroup): boolean {
  return Date.now() - g.lastSeen.getTime() > 24 * 60 * 60 * 1000
}
