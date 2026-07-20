// "Did you mean `X`?" suggestion for schema column-reference findings. Given a
// referenced (unknown) column and the set of available columns, find the
// nearest candidate by Levenshtein edit distance — but only suggest it when it
// is within a length-scaled threshold, so a typo (`usr_id` → `user_id`) is
// surfaced while an unrelated name produces no (misleading) suggestion.

/** Classic Levenshtein distance (insert/delete/substitute, cost 1 each). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Single-row DP — O(min(a,b)) space.
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** The edit-distance ceiling for a suggestion: small and length-scaled, so
 *  short identifiers must be very close and longer ones get a little slack. */
export function suggestionThreshold(target: string): number {
  return Math.max(2, Math.floor(target.length / 3))
}

export interface NearestCandidate {
  readonly candidate: string
  readonly distance: number
}

/**
 * Return the nearest candidate to `target` within the suggestion threshold, or
 * `undefined` when nothing is close enough. Comparison is case-insensitive for
 * ranking but the original candidate spelling is returned. Ties resolve to the
 * earliest candidate in declaration order (deterministic output).
 */
export function nearestCandidate(
  target: string,
  candidates: readonly string[],
): NearestCandidate | undefined {
  const threshold = suggestionThreshold(target)
  const needle = target.toLowerCase()
  let best: NearestCandidate | undefined

  for (const candidate of candidates) {
    if (candidate === target) continue // exact match is not a "did you mean"
    const distance = editDistance(needle, candidate.toLowerCase())
    if (distance > threshold) continue
    if (!best || distance < best.distance) {
      best = { candidate, distance }
      if (distance === 1) break // can't do better than an off-by-one
    }
  }

  return best
}
