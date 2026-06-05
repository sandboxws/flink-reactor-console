// The `$flink-reactor` problem-matcher pattern (cli-lifecycle-integration §2).
//
// The MANIFEST owns the declarative `problemMatchers` contribution (VS Code
// parses task output with it); this module is the same pattern as code so the
// fixture test can pin the parsing behavior and a parity test can assert the
// manifest never drifts from it (single source of truth, mirroring the
// KIND_COLORS parity pattern).
//
// Matched shape — the CLI's documented machine-oriented diagnostic line:
//
//   <file>:<line>:<col> <severity> <FR-code> <message>
//   pipelines/orders/index.tsx:12:5 error FR-SCHEMA-001 Unknown column `amont`
//
// Lines that do not match (the CLI's human-readable summary output) pass
// through as plain terminal output — the matcher grabs nothing it does not
// own. The matcher's owner/source is `flink-reactor-cli`, DISTINCT from the
// language server's `flink-reactor` diagnostic source (codes.ts
// DIAGNOSTIC_SOURCE) so the two never double-report: the LSP owns live editor
// squiggles; the matcher owns the result of an explicit CLI run. The
// manifest's `"clear": true` makes a re-run clear the owner's previous
// problems at task start, so a clean run leaves the Problems panel empty —
// without it, stale resources from a previous run are never removed.

/** The manifest `pattern.regexp` (keep in lock-step — parity-tested). */
export const PROBLEM_PATTERN_REGEXP =
  "^\\s*(.+?):(\\d+):(\\d+)\\s+(error|warning)\\s+(FR[A-Za-z0-9-]*)\\s+(.+)$"

export interface ParsedProblem {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly severity: "error" | "warning"
  readonly code: string
  readonly message: string
}

/** Parse one output line exactly as the manifest pattern would; `null` for a
 *  non-matching line (it stays plain output). */
export function parseProblemLine(line: string): ParsedProblem | null {
  const match = new RegExp(PROBLEM_PATTERN_REGEXP).exec(line)
  if (!match) return null
  const [, file, lineNo, column, severity, code, message] = match
  if (!file || !lineNo || !column || !severity || !code || !message) return null
  return {
    file,
    line: Number(lineNo),
    column: Number(column),
    severity: severity as "error" | "warning",
    code,
    message,
  }
}
