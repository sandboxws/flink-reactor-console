export interface RestartDecision {
  /** Whether to restart the server or give up. */
  readonly action: "restart" | "stop"
  /** Milliseconds to wait before restarting (0 when stopping). */
  readonly delayMs: number
  /** Human-readable rationale, logged to the output channel (and shown on stop). */
  readonly reason: string
}

const WINDOW_MS = 180_000
const MAX = 5
const RESTART_DELAY_MS = 1_000

/**
 * Decide whether to restart the language server after it exited.
 *
 * Policy: resilient with a hard stop. Restart quickly (1s) up to {@link MAX}
 * times within a sliding {@link WINDOW_MS} window; once exceeded, give up so a
 * genuinely broken server does not crash-loop. The caller logs `reason` and, on
 * `"stop"`, surfaces it to the user.
 *
 * Pure (no `vscode`/clock dependency) so the policy is unit-testable.
 *
 * @param crashTimestamps epoch-ms of recent server exits, this one included last
 * @param now current epoch-ms
 */
export function decideRestart(
  crashTimestamps: readonly number[],
  now: number,
): RestartDecision {
  const recent = crashTimestamps.filter((t) => now - t < WINDOW_MS)
  if (recent.length > MAX) {
    return {
      action: "stop",
      delayMs: 0,
      reason: `${recent.length} crashes in 3 min — giving up`,
    }
  }
  return {
    action: "restart",
    delayMs: RESTART_DELAY_MS,
    reason: `restart ${recent.length}/${MAX}`,
  }
}
