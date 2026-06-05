// Vitest JSON-reporter parsing (test-explorer §3.4): the machine-readable
// contract (`--reporter=json`, jest-compatible schema) → flat per-test
// records, tolerating unknown fields and missing pieces. Also the
// brace-balanced extractor the WATCH profile uses: `vitest --watch
// --reporter=json` re-emits a complete JSON document after each cycle on a
// stdout stream that may interleave other text.

export interface VitestTestRecord {
  /** Absolute test-file path as Vitest reports it. */
  readonly file: string
  /** Full concatenated title (`describe path > it title`). */
  readonly fullName: string
  /** The `it` title alone (last segment). */
  readonly title: string
  readonly state: "pass" | "fail" | "skip"
  /** Milliseconds, when reported. */
  readonly duration?: number
  /** Raw failure messages (first is the assertion failure). */
  readonly failureMessages: readonly string[]
}

export interface VitestRunSummary {
  readonly success: boolean
  readonly records: readonly VitestTestRecord[]
}

/** Parse one complete Vitest JSON document. Returns `null` when the payload
 *  is not parseable as the expected shape (task 10.4 surfaces the reason). */
export function parseVitestJson(payload: string): VitestRunSummary | null {
  let root: unknown
  try {
    root = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof root !== "object" || root === null) return null
  const doc = root as {
    success?: unknown
    testResults?: unknown
  }
  if (!Array.isArray(doc.testResults)) return null

  const records: VitestTestRecord[] = []
  for (const fileResult of doc.testResults) {
    if (typeof fileResult !== "object" || fileResult === null) continue
    const fr = fileResult as {
      name?: unknown
      assertionResults?: unknown
    }
    const file = typeof fr.name === "string" ? fr.name : ""
    if (!Array.isArray(fr.assertionResults)) continue
    for (const assertion of fr.assertionResults) {
      if (typeof assertion !== "object" || assertion === null) continue
      const a = assertion as {
        ancestorTitles?: unknown
        title?: unknown
        fullName?: unknown
        status?: unknown
        duration?: unknown
        failureMessages?: unknown
      }
      const title = typeof a.title === "string" ? a.title : ""
      const ancestors = Array.isArray(a.ancestorTitles)
        ? a.ancestorTitles.filter((t): t is string => typeof t === "string")
        : []
      // Vitest's reported `fullName` is SPACE-joined ("suite case") — an
      // ambiguous concatenation. Rebuild it from `ancestorTitles` + `title`
      // with an explicit " > " separator so item matching is exact; fall
      // back to the reporter's field only when the parts are absent.
      const rebuilt = [...ancestors, title]
        .filter((t) => t.length > 0)
        .join(" > ")
      const fullName =
        rebuilt.length > 0
          ? rebuilt
          : typeof a.fullName === "string"
            ? a.fullName
            : ""
      const status = String(a.status ?? "")
      const state: VitestTestRecord["state"] =
        status === "passed" ? "pass" : status === "failed" ? "fail" : "skip"
      records.push({
        file,
        fullName,
        title,
        state,
        ...(typeof a.duration === "number" ? { duration: a.duration } : {}),
        failureMessages: Array.isArray(a.failureMessages)
          ? a.failureMessages.filter((m): m is string => typeof m === "string")
          : [],
      })
    }
  }
  return { success: doc.success === true, records }
}

/**
 * Pull complete top-level JSON objects out of a mixed stdout stream
 * (the watch profile's incremental cycles). Returns the extracted documents
 * and the remaining (incomplete) tail to re-feed on the next chunk.
 */
export function extractJsonDocuments(buffer: string): {
  readonly documents: readonly string[]
  readonly rest: string
} {
  const documents: string[] = []
  let i = 0
  let rest = buffer
  while (true) {
    const start = rest.indexOf("{", i)
    if (start === -1) return { documents, rest: "" }
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let j = start; j < rest.length; j++) {
      const ch = rest[j]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end === -1) {
      // Incomplete document — keep from its start for the next chunk.
      return { documents, rest: rest.slice(start) }
    }
    const candidate = rest.slice(start, end + 1)
    // Only keep payloads that look like Vitest run documents.
    if (candidate.includes('"testResults"')) documents.push(candidate)
    rest = rest.slice(end + 1)
    i = 0
  }
}
