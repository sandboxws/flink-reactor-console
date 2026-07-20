// Expected/received SQL extraction from a Vitest snapshot failure
// (test-explorer §6.2). The JSON reporter carries failures as STRINGS (no
// structured expected/actual), in the standard snapshot-diff format:
//
//   Error: Snapshot `orders pipeline > synthesizes stable SQL 1` mismatched
//   - Expected
//   + Received
//
//     "CREATE TABLE …
//   -   `amount` DECIMAL(10, 2)
//   +   `amount` DOUBLE
//     …"
//
// `- `-prefixed lines are the stored snapshot (expected), `+ `-prefixed the
// fresh value (received), and unprefixed (two-space) lines are shared
// context belonging to both. ANSI escapes are stripped first (the runner
// also forces NO_COLOR, but stay defensive).

export interface SnapshotSides {
  readonly expected: string
  readonly received: string
}

// Built from a char code so no control character appears in source (Biome).
const ESC = String.fromCharCode(27)
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g")

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "")
}

/** True when a failure message is a snapshot mismatch (vs an ordinary
 *  assertion failure) — the golden-diff opens only for these. */
export function isSnapshotMismatch(message: string): boolean {
  return /toMatchSnapshot|Snapshot\s+`[^`]*`\s+mismatched/i.test(
    stripAnsi(message),
  )
}

/** Reconstruct both sides of a snapshot diff, or `null` when the message
 *  carries no recognizable diff body. */
export function extractSnapshotSides(message: string): SnapshotSides | null {
  const text = stripAnsi(message)
  const lines = text.split("\n")
  const headerIndex = lines.findIndex((l) => l.trim() === "- Expected")
  if (headerIndex === -1 || lines[headerIndex + 1]?.trim() !== "+ Received") {
    return null
  }
  const expected: string[] = []
  const received: string[] = []
  let sawDiffLine = false
  for (const raw of lines.slice(headerIndex + 2)) {
    // Stack frames terminate the diff body.
    if (/^\s+at\s/.test(raw)) break
    if (raw.startsWith("- ")) {
      expected.push(raw.slice(2))
      sawDiffLine = true
    } else if (raw.startsWith("+ ")) {
      received.push(raw.slice(2))
      sawDiffLine = true
    } else if (raw.startsWith("  ")) {
      expected.push(raw.slice(2))
      received.push(raw.slice(2))
    } else if (raw.trim().length === 0) {
      expected.push("")
      received.push("")
    }
  }
  if (!sawDiffLine) return null
  return {
    expected: trimOuterBlank(expected).join("\n"),
    received: trimOuterBlank(received).join("\n"),
  }
}

function trimOuterBlank(lines: readonly string[]): readonly string[] {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]?.trim() === "") start++
  while (end > start && lines[end - 1]?.trim() === "") end--
  return lines.slice(start, end)
}

/**
 * Locate a named snapshot's diff in the DEFAULT reporter's stdout and
 * reconstruct both sides. Vitest's JSON reporter carries failures as
 * message+stack ONLY (no diff body, no structured expected/actual), while
 * the default reporter prints the full `- Expected / + Received` block right
 * after the same backticked snapshot name — making the name the join key
 * between the two streams.
 */
export function extractSidesFromOutput(
  output: string,
  snapshotName: string,
): SnapshotSides | null {
  const text = stripAnsi(output)
  const anchor = `Snapshot \`${snapshotName}\` mismatched`
  const start = text.lastIndexOf(anchor)
  if (start === -1) return null
  // The diff body ends at the next failure separator / FAIL header.
  const tail = text.slice(start)
  const end = tail.search(/\n\s*⎯{3,}|\nFAIL\s|\n\s*✓ |\n\s*× /)
  return extractSnapshotSides(end === -1 ? tail : tail.slice(0, end))
}

/** The backticked snapshot name out of a mismatch failure message. */
export function snapshotNameOf(message: string): string | undefined {
  const match = /Snapshot `(.+?)` mismatched/.exec(stripAnsi(message))
  return match?.[1]
}
