// Environment discovery from `flink-reactor.config.ts` (task 4.1).
//
// The config's `environments` block names the project's deploy targets:
//
//   export default defineConfig({
//     environments: {
//       development: { … },
//       "staging-eu": { … },
//       production: { … },
//     },
//   })
//
// The host cannot execute the config (that needs the DSL's jiti loader — a
// worker-side concern) and bundling the TypeScript compiler into the
// extension host for one key scan would bloat it by ~8 MB, so this is a
// small, conservative lexical scan: find the `environments` object literal
// and collect its depth-1 keys (identifiers or string literals), skipping
// strings/comments and tracking brace depth. Conventional configs (the
// scaffolder templates and every fixture in the repo) parse exactly; an
// exotic computed config degrades to "no environments discovered", which the
// switcher surfaces honestly (commands then run without `--env`).

import { readFileSync } from "node:fs"
import { join } from "node:path"

export function discoverEnvironments(projectDir: string): string[] {
  let text: string
  try {
    text = readFileSync(join(projectDir, "flink-reactor.config.ts"), "utf8")
  } catch {
    return []
  }
  return scanEnvironmentNames(text)
}

/** Extract the depth-1 keys of the `environments: { … }` object literal. */
export function scanEnvironmentNames(configText: string): string[] {
  const anchor = configText.search(/\benvironments\s*:/)
  if (anchor === -1) return []
  const braceStart = configText.indexOf("{", anchor)
  if (braceStart === -1) return []

  const names: string[] = []
  let depth = 0
  let i = braceStart
  let atKeyPosition = true // start of the object → first token is a key

  while (i < configText.length) {
    const ch = configText[i]
    // ── Skip comments and strings wholesale ─────────────────────────
    if (ch === "/" && configText[i + 1] === "/") {
      i = skipLine(configText, i)
      continue
    }
    if (ch === "/" && configText[i + 1] === "*") {
      const end = configText.indexOf("*/", i + 2)
      i = end === -1 ? configText.length : end + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const { end, value } = readString(configText, i)
      // A string at key position at depth 1 is a quoted environment name.
      if (depth === 1 && atKeyPosition && value !== null) {
        if (isKeyFollowedByColon(configText, end)) {
          names.push(value)
          atKeyPosition = false
        }
      }
      i = end
      continue
    }

    if (ch === "{") {
      depth++
      atKeyPosition = depth === 1
      i++
      continue
    }
    if (ch === "}") {
      depth--
      if (depth === 0) break // end of the environments object
      atKeyPosition = false
      i++
      continue
    }
    if (ch === ",") {
      if (depth === 1) atKeyPosition = true
      i++
      continue
    }

    // Identifier key at depth 1 (e.g. `development:`).
    if (
      depth === 1 &&
      atKeyPosition &&
      ch !== undefined &&
      /[A-Za-z_$]/.test(ch)
    ) {
      let j = i + 1
      while (j < configText.length) {
        const cj = configText[j]
        if (cj === undefined || !/[A-Za-z0-9_$]/.test(cj)) break
        j++
      }
      if (isKeyFollowedByColon(configText, j)) {
        names.push(configText.slice(i, j))
        atKeyPosition = false
      }
      i = j
      continue
    }

    i++
  }
  return names
}

function skipLine(text: string, from: number): number {
  const nl = text.indexOf("\n", from)
  return nl === -1 ? text.length : nl + 1
}

function readString(
  text: string,
  start: number,
): { end: number; value: string | null } {
  const quote = text[start]
  let i = start + 1
  let value = ""
  while (i < text.length) {
    const ch = text[i]
    if (ch === "\\") {
      value += text[i + 1] ?? ""
      i += 2
      continue
    }
    if (ch === quote) return { end: i + 1, value }
    value += ch
    i++
  }
  return { end: text.length, value: null }
}

function isKeyFollowedByColon(text: string, from: number): boolean {
  let i = from
  while (i < text.length) {
    const ch = text[i]
    if (ch === undefined || !/\s/.test(ch)) break
    i++
  }
  return text[i] === ":"
}
