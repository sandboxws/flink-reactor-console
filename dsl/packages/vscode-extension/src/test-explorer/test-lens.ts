// Run/Debug CodeLens over open `tests/pipelines/*.test.ts` files
// (test-explorer §8.2), complementing the Test API's native gutter
// decorations: a file-level row plus one per discovered `it`, each wired to
// the controller's run/debug profiles through the corresponding `TestItem`s.

import { basename, dirname } from "node:path"
import * as vscode from "vscode"
import { type ScannedTest, scanTestFile } from "./test-scan.js"

export const RUN_TESTS_COMMAND = "flinkReactor.runPipelineTestItem"

/** True for `tests/pipelines/<name>.test.ts` paths. */
export function isPipelineTestFile(fsPath: string): boolean {
  if (!fsPath.endsWith(".test.ts")) return false
  const dir = dirname(fsPath)
  return basename(dir) === "pipelines" && basename(dirname(dir)) === "tests"
}

export class PipelineTestLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!isPipelineTestFile(document.uri.fsPath)) return []
    const lenses: vscode.CodeLens[] = [
      runLens(document.uri, undefined, false, "$(play) Run pipeline tests", 0),
      runLens(document.uri, undefined, true, "Debug", 0),
    ]
    const walk = (
      tests: readonly ScannedTest[],
      ancestors: readonly string[],
    ): void => {
      for (const test of tests) {
        const titlePath = [...ancestors, test.title]
        if (test.kind === "it") {
          const full = titlePath.join(" > ")
          lenses.push(
            runLens(document.uri, full, false, "$(play) Run", test.line),
            runLens(document.uri, full, true, "Debug", test.line),
          )
        }
        walk(test.children, titlePath)
      }
    }
    walk(scanTestFile(document.getText()), [])
    return lenses
  }
}

function runLens(
  uri: vscode.Uri,
  fullTitle: string | undefined,
  debug: boolean,
  title: string,
  line: number,
): vscode.CodeLens {
  return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
    title,
    command: RUN_TESTS_COMMAND,
    arguments: [uri, fullTitle, debug],
  })
}
