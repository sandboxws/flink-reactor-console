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

async function openOrders(): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(ordersUri())
  return vscode.window.showTextDocument(doc)
}

function dagTabCount(): number {
  let n = 0
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input as { viewType?: string } | undefined
      if ((input?.viewType ?? "").includes("flinkReactor.graph")) n++
      else if (tab.label.includes("DAG")) n++
    }
  }
  return n
}

let api: FlinkReactorApi

suite("FlinkReactor DAG panel (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  test("registers the openGraph command", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.openGraph"))
  })

  // 6.1 — open a fixture pipeline, run the command, the panel renders the
  // expected node count (KafkaSource → Filter → GenericSink = 3).
  test("opens the panel and renders the pipeline's nodes", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.openGraph")

    const info = await until(
      () => api.dag.renderInfo(),
      (r) => r.ok && r.nodeCount > 0,
    )
    assert.strictEqual(info.nodeCount, 3, "expected 3 dataflow nodes")
    assert.strictEqual(dagTabCount(), 1, "exactly one DAG panel")
  })

  // Singleton — re-invoking reveals the existing panel.
  test("re-invoking keeps a single panel", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.openGraph")
    await wait(1_000)
    assert.strictEqual(dagTabCount(), 1)
  })

  // 6.3 — driving the click-to-source path moves the editor selection to the
  // node's JSX range.
  test("navigates from a node to its JSX", async () => {
    await openOrders()
    await vscode.commands.executeCommand("flinkReactor.openGraph")
    await until(
      () => api.dag.renderInfo(),
      (r) => r.ok && r.nodeCount === 3,
    )

    await api.dag.revealNode("orders")
    await wait(500)
    const editor = vscode.window.activeTextEditor
    assert.ok(editor, "an editor should be active after navigation")
    assert.ok(
      editor.document.uri.fsPath.endsWith("index.tsx"),
      "the pipeline file should be focused",
    )
    // The KafkaSource element sits below the imports — a non-zero line.
    assert.ok(
      editor.selection.start.line > 0,
      "selection should land on the node's JSX range",
    )
  })

  // 6.2 + 6.4 — a live edit re-synthesizes: a syntax/runtime error degrades to
  // the error envelope (panel stays open), and reverting recovers.
  test("degrades on a synthesis error and recovers on fix", async () => {
    const editor = await openOrders()
    await vscode.commands.executeCommand("flinkReactor.openGraph")
    await until(
      () => api.dag.renderInfo(),
      (r) => r.ok && r.nodeCount === 3,
    )

    // Break it: prepend a throwing statement (runs after the hoisted imports).
    await editor.edit((b) =>
      b.insert(new vscode.Position(0, 0), "throw new Error('boom')\n"),
    )
    const errored = await until(
      () => api.dag.renderInfo(),
      (r) => !r.ok,
    )
    assert.strictEqual(errored.ok, false, "model should report failure")
    assert.strictEqual(dagTabCount(), 1, "panel survives the error")

    // Fix it: delete the line we inserted (deterministic; no focus-dependent
    // revert command), restoring the original buffer.
    await editor.edit((b) =>
      b.delete(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)),
      ),
    )
    const recovered = await until(
      () => api.dag.renderInfo(),
      (r) => r.ok && r.nodeCount === 3,
    )
    assert.strictEqual(recovered.ok, true, "model recovers after the fix")
  })
})
