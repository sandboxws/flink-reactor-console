import * as assert from "node:assert"
import { join } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorApi } from "../../src/extension"

const EXTENSION_ID = "flink-reactor.flink-reactor"

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0]
  assert.ok(folder, "expected an open workspace folder")
  return folder.uri.fsPath
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Poll until `predicate()` holds or the deadline passes. */
async function until<T>(
  get: () => T | undefined,
  predicate: (v: T) => boolean,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = get()
    if (v !== undefined && predicate(v)) return v
    await wait(250)
  }
  throw new Error("condition not met before timeout")
}

function ordersUri(): vscode.Uri {
  return vscode.Uri.file(
    join(workspaceRoot(), "pipelines", "orders", "index.tsx"),
  )
}

function ordersUriString(): string {
  return ordersUri().toString()
}

async function openOrders(): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(ordersUri())
  return vscode.window.showTextDocument(doc)
}

/** Move the caret to the first occurrence of `needle` (offset by `delta`). */
function caretAt(editor: vscode.TextEditor, needle: string, delta = 2): void {
  const offset = editor.document.getText().indexOf(needle)
  assert.ok(offset >= 0, `expected to find "${needle}" in the pipeline`)
  const pos = editor.document.positionAt(offset + delta)
  editor.selection = new vscode.Selection(pos, pos)
}

function sqlPreviewTabCount(): number {
  let n = 0
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input as { viewType?: string } | undefined
      if ((input?.viewType ?? "").includes("flinkReactor.sqlPreview")) n++
      else if (tab.label.startsWith("SQL —")) n++
    }
  }
  return n
}

let api: FlinkReactorApi

suite("FlinkReactor SQL preview (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  test("registers the showSqlPreview command", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.showSqlPreview"))
  })

  // 7.1 — open the preview; the webview renders the pipeline's statements as
  // labeled blocks (Source → Filter/INSERT → Sink ⇒ 4 blocks from 8 statements,
  // banners folded), and exactly one panel exists.
  test("opens the preview and renders the statement blocks", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")

    const info = await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount > 0,
    )
    assert.strictEqual(info.blockCount, 4, "Pipeline + Source + Sink + INSERT")
    assert.ok(
      info.statementCount > info.blockCount,
      "raw statements include the folded comment banners",
    )
    assert.strictEqual(sqlPreviewTabCount(), 1, "exactly one SQL preview panel")
  })

  // 2.2 — re-invoking reveals the existing panel rather than duplicating.
  test("re-invoking keeps a single panel", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    await wait(1_000)
    assert.strictEqual(sqlPreviewTabCount(), 1)
    assert.strictEqual(api.sqlPreview.count(), 1)
  })

  // 7.2 — DSL→SQL: caret on <Filter> lights up its contributed WHERE span;
  // caret on <KafkaSource> lights up its whole CREATE TABLE block.
  test("caret on a node highlights its statement / contributed span", async () => {
    const editor = await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount === 4,
    )

    // Caret on the Filter → its predicate span (sub-statement highlight).
    caretAt(editor, "<Filter")
    const filterHit = await until(
      () => api.sqlPreview.lastHighlight(ordersUriString()),
      (h) => h.nodeId === "Filter_1",
    )
    assert.ok(
      filterHit.spanCount >= 1,
      "the Filter's WHERE-clause span is highlighted",
    )

    // Caret on the source → its whole CREATE TABLE block (statement highlight).
    caretAt(editor, "<KafkaSource")
    const sourceHit = await until(
      () => api.sqlPreview.lastHighlight(ordersUriString()),
      (h) => h.nodeId === "orders",
    )
    assert.ok(
      sourceHit.wholeCount >= 1,
      "the source's CREATE TABLE statement is highlighted",
    )
  })

  // 4.5 — caret off any node clears the highlight and lights up nothing.
  test("caret off any node highlights nothing (no error)", async () => {
    const editor = await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok,
    )
    // Column 0 of the very first import line is inside no element range.
    editor.selection = new vscode.Selection(0, 0, 0, 0)
    const cleared = await until(
      () => api.sqlPreview.lastHighlight(ordersUriString()),
      (h) => h.nodeId === null,
    )
    assert.strictEqual(cleared.wholeCount, 0)
    assert.strictEqual(cleared.spanCount, 0)
  })

  // 7.3 — SQL→DSL: driving the reveal path selects the node's JSX range.
  test("clicking a SQL span navigates to the node's JSX", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount === 4,
    )

    await api.sqlPreview.revealNode(ordersUriString(), "orders")
    await wait(500)
    const editor = vscode.window.activeTextEditor
    assert.ok(editor, "an editor should be active after navigation")
    assert.ok(
      editor.document.uri.fsPath.endsWith("index.tsx"),
      "the pipeline file should be focused",
    )
    assert.ok(
      editor.selection.start.line > 0,
      "selection should land on the source node's JSX range",
    )
  })

  // 7.4 — a live edit re-synthesizes and the preview refreshes (newer version).
  test("refreshes on a live edit", async () => {
    const editor = await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    const before = await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount === 4,
    )

    // Bump the Filter threshold — a content change the server re-synthesizes.
    const text = editor.document.getText()
    const offset = text.indexOf("> 100")
    assert.ok(offset >= 0, "the Filter condition should contain `> 100`")
    await editor.edit((b) =>
      b.replace(
        new vscode.Range(
          editor.document.positionAt(offset),
          editor.document.positionAt(offset + "> 100".length),
        ),
        "> 200",
      ),
    )

    const after = await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.version > before.version,
    )
    assert.ok(after.version > before.version, "preview re-rendered after edit")
  })

  // 7.5 — a synthesis error keeps the last good SQL behind a stale banner
  // (the panel stays open and is not blanked), and fixing it recovers.
  test("retains last good SQL on failure and recovers on fix", async () => {
    const editor = await openOrders()
    await vscode.commands.executeCommand("flinkReactor.showSqlPreview")
    await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount === 4,
    )

    // Break it: prepend a throwing statement (runs after the hoisted imports).
    await editor.edit((b) =>
      b.insert(new vscode.Position(0, 0), "throw new Error('boom')\n"),
    )
    const stale = await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => !r.ok,
    )
    assert.strictEqual(stale.ok, false, "render reports the failure")
    assert.ok(stale.blockCount > 0, "last good SQL is retained, not blanked")
    assert.strictEqual(sqlPreviewTabCount(), 1, "panel survives the error")

    // Fix it: delete the line we inserted, restoring the original buffer.
    await editor.edit((b) =>
      b.delete(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)),
      ),
    )
    const recovered = await until(
      () => api.sqlPreview.renderInfo(ordersUriString()),
      (r) => r.ok && r.blockCount === 4,
    )
    assert.strictEqual(recovered.ok, true, "preview recovers after the fix")
  })
})
