// Shared loader for the component-refactoring tests: synthesize a fixture
// into the held per-document state the refactorings read, with the marker-
// based cursor helpers the other provider tests use, plus the apply →
// re-synthesize parity loop (design: every rename/fix fixture re-synthesizes
// after applying the edit and asserts no new finding).

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { WorkspaceEdit } from "vscode-languageserver"
import type { DocumentSynthState } from "../../src/document-state"
import { buildPositionMap } from "../../src/mappers/source-position-mapper"
import { applyWorkspaceEdit } from "../../src/refactor/parity"
import { synthesizeDocument } from "../../src/synth/runner"
import type { SynthesisResult } from "../../src/synth/types"

export const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
)

export interface Loaded {
  readonly uri: string
  readonly text: string
  readonly entryPoint: string
  readonly state: DocumentSynthState
}

/** Synthesize a fixture into the shared per-document state. */
export async function load(name: string): Promise<Loaded> {
  const entryPoint = join(FIXTURES, name)
  const text = readFileSync(entryPoint, "utf8")
  const result = await synthesizeDocument({ entryPoint, projectDir: FIXTURES })
  const positionMap = buildPositionMap(text, entryPoint, result.nodes)
  const uri = pathToFileURL(entryPoint).href
  return {
    uri,
    text,
    entryPoint,
    state: { uri, version: 1, result, positionMap },
  }
}

/** Cursor `delta` characters into the first occurrence of `marker`. */
export function posAt(
  text: string,
  marker: string,
  delta = 0,
): { line: number; character: number } {
  const idx = text.indexOf(marker)
  if (idx < 0) throw new Error(`marker not found: ${marker}`)
  const before = text.slice(0, idx + delta).split("\n")
  return {
    line: before.length - 1,
    character: before[before.length - 1].length,
  }
}

/** Apply a (single-document) `WorkspaceEdit` to the fixture text and
 *  re-synthesize the result against the same entry point — the parity loop. */
export async function applyAndResynthesize(
  loaded: Loaded,
  edit: WorkspaceEdit,
): Promise<{ text: string; result: SynthesisResult }> {
  const applied = applyWorkspaceEdit({ [loaded.uri]: loaded.text }, edit)
  const text = applied[loaded.uri]
  const result = await synthesizeDocument({
    entryPoint: loaded.entryPoint,
    projectDir: FIXTURES,
    documentText: text,
  })
  return { text, result }
}
