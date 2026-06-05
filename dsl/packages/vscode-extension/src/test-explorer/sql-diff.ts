// The SQL golden-diff viewer (test-explorer §6): a failed SQL snapshot's
// stored (expected) and freshly generated (received) SQL exposed as two
// READ-ONLY virtual `.sql` documents under the `flinkreactor-sql-diff:`
// scheme and opened with VS Code's native diff editor — side-by-side,
// word/line diffing, SQL syntax highlighting. No webview, no temp files; the
// documents are ephemeral projections of the last run's failures. The diff
// is read-only by design: blessing happens via `--update`, never manual
// edits (the change's Non-Goals).

import * as vscode from "vscode"
import type { SnapshotSides } from "./sql-extract.js"

export const SQL_DIFF_SCHEME = "flinkreactor-sql-diff"

/** Last SQL-snapshot failure per test-item id (the run handler maintains
 *  this; the open command and the diff provider read it). */
const failures = new Map<string, SnapshotSides>()

const emitter = new vscode.EventEmitter<vscode.Uri>()

export function setSqlFailure(testId: string, sides: SnapshotSides): void {
  failures.set(testId, sides)
  emitter.fire(uriFor(testId, "expected"))
  emitter.fire(uriFor(testId, "received"))
}

export function clearSqlFailure(testId: string): void {
  if (!failures.delete(testId)) return
  emitter.fire(uriFor(testId, "expected"))
  emitter.fire(uriFor(testId, "received"))
}

export function hasSqlFailure(testId: string): boolean {
  return failures.has(testId)
}

export function firstSqlFailureId(): string | undefined {
  return failures.keys().next().value
}

function uriFor(testId: string, side: "expected" | "received"): vscode.Uri {
  return vscode.Uri.from({
    scheme: SQL_DIFF_SCHEME,
    path: `/${side}.sql`,
    query: encodeURIComponent(testId),
  })
}

export function registerSqlDiffProvider(): vscode.Disposable {
  return vscode.workspace.registerTextDocumentContentProvider(SQL_DIFF_SCHEME, {
    onDidChange: emitter.event,
    provideTextDocumentContent: (uri) => {
      const sides = failures.get(decodeURIComponent(uri.query))
      if (!sides) return "-- no snapshot failure recorded for this test --"
      return uri.path.startsWith("/expected") ? sides.expected : sides.received
    },
  })
}

/** Open the side-by-side golden diff for a failed SQL snapshot test. */
export async function openSqlGoldenDiff(testId: string): Promise<boolean> {
  if (!failures.has(testId)) return false
  const title = `SQL snapshot — expected ⟷ received (${shortLabel(testId)})`
  await vscode.commands.executeCommand(
    "vscode.diff",
    uriFor(testId, "expected"),
    uriFor(testId, "received"),
    title,
    { preview: true },
  )
  return true
}

/** Close any open golden-diff tab for a test whose snapshot was updated —
 *  its premise (a mismatch) no longer holds (task 7.4). */
export async function closeSqlGoldenDiff(testId: string): Promise<void> {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input
      if (
        input instanceof vscode.TabInputTextDiff &&
        input.original.scheme === SQL_DIFF_SCHEME &&
        decodeURIComponent(input.original.query) === testId
      ) {
        await vscode.window.tabGroups.close(tab)
      }
    }
  }
}

function shortLabel(testId: string): string {
  const tail = testId.split("#").pop() ?? testId
  return tail.length > 48 ? `…${tail.slice(-47)}` : tail
}
