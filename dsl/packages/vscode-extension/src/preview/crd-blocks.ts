// Pure, line-local YAML highlighter for the CRD-preview webview.
//
// The webview renders generated Kubernetes YAML read-only. It cannot use the
// editor's TextMate grammar (a webview has no grammar host) and must honor a
// strict CSP (no `innerHTML`), so highlighting is done here: each line is
// tokenized into `{ text, cls }` segments that the renderer turns into
// `<span class="…">` text nodes. Keeping this pure (no DOM) makes it unit-
// testable and keeps the webview a dumb DOM binding.
//
// The tokenizer is intentionally *line-local* (no cross-line block-scalar
// state): `toYaml` emits simple block-style YAML, and any block-scalar body
// lines simply fall through as plain text — correct, just uncolored. This
// trades a little fidelity for a tokenizer that can never desync on large docs.

/** A highlight class. Maps to a `.y-*` CSS rule in the webview stylesheet. */
export type YamlClass = "key" | "string" | "number" | "comment" | "punct"

/** A contiguous run of text with an optional highlight class. */
export interface YamlSegment {
  readonly text: string
  readonly cls?: YamlClass
}

const KEY_RE = /^("[^"]*"|'[^']*'|[^:#\s][^:#]*?)\s*:(?=\s|$)/
const NUMBER_RE = /^-?\d+(?:\.\d+)?$/
const KEYWORD_RE = /^(?:true|false|null|~)$/i

/**
 * Tokenize a single YAML line into highlight segments whose concatenated
 * `text` is exactly the input line (so the renderer can rebuild the line as
 * text nodes without altering a byte).
 */
export function highlightYamlLine(line: string): YamlSegment[] {
  const segments: YamlSegment[] = []
  let rest = line

  // Leading indentation — emitted verbatim (plain) so columns line up.
  const indentMatch = rest.match(/^\s+/)
  if (indentMatch) {
    segments.push({ text: indentMatch[0] })
    rest = rest.slice(indentMatch[0].length)
  }

  // A list marker (`- ` or a bare `-`) is punctuation; the remainder may still
  // be a `key: value` or a scalar, so fall through after consuming it.
  const listMatch = rest.match(/^-(\s+|$)/)
  if (listMatch) {
    segments.push({ text: rest.slice(0, 1), cls: "punct" })
    segments.push({ text: listMatch[1] })
    rest = rest.slice(listMatch[0].length)
  }

  // A whole-line (or post-marker) comment.
  if (rest.startsWith("#")) {
    segments.push({ text: rest, cls: "comment" })
    return segments
  }

  // `key:` — the key (with any surrounding quotes) plus its colon.
  const keyMatch = rest.match(KEY_RE)
  if (keyMatch) {
    const key = keyMatch[1]
    segments.push({ text: key, cls: "key" })
    // Everything between the key and the colon (rare trailing spaces) + colon.
    const afterKey = rest.slice(key.length)
    const colonIdx = afterKey.indexOf(":")
    if (colonIdx > 0) segments.push({ text: afterKey.slice(0, colonIdx) })
    segments.push({ text: ":", cls: "punct" })
    rest = afterKey.slice(colonIdx + 1)
    appendValue(segments, rest)
    return segments
  }

  // No key on this line (block-scalar body, a bare list scalar, …) — classify
  // it as a value run.
  appendValue(segments, rest)
  return segments
}

/** Append the value side of a line (after `key:` or a list marker), splitting
 *  off any inline ` #` comment and classifying the scalar. */
function appendValue(segments: YamlSegment[], value: string): void {
  if (value.length === 0) return

  // Leading whitespace before the value (verbatim).
  const lead = value.match(/^\s+/)?.[0] ?? ""
  if (lead) segments.push({ text: lead })
  let scalar = value.slice(lead.length)
  if (scalar.length === 0) return

  // Inline comment: ` #…` to end of line. Not split inside a quoted scalar
  // (handled below by consuming the quote first).
  let comment = ""
  if (!scalar.startsWith('"') && !scalar.startsWith("'")) {
    const hashIdx = scalar.indexOf(" #")
    if (hashIdx >= 0) {
      comment = scalar.slice(hashIdx)
      scalar = scalar.slice(0, hashIdx)
    }
  }

  if (scalar) segments.push(classifyScalar(scalar))
  if (comment) segments.push({ text: comment, cls: "comment" })
}

/** Classify a bare/quoted scalar value into a single segment. */
function classifyScalar(scalar: string): YamlSegment {
  if (
    (scalar.startsWith('"') && scalar.endsWith('"')) ||
    (scalar.startsWith("'") && scalar.endsWith("'"))
  ) {
    return { text: scalar, cls: "string" }
  }
  if (
    scalar === "|" ||
    scalar === ">" ||
    scalar.startsWith("|") ||
    scalar.startsWith(">")
  ) {
    return { text: scalar, cls: "punct" }
  }
  if (NUMBER_RE.test(scalar) || KEYWORD_RE.test(scalar)) {
    return { text: scalar, cls: "number" }
  }
  return { text: scalar }
}
