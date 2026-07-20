// tap-visualization (Tier-3 feature 13) e2e: the tap panel lists tapped
// operators with strategy/schema/SQL, live-refreshes on edits with stable
// identity, navigates tap→JSX, overlays the DAG, renders the graceful empty
// state, and reports the configured console push target.

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

function pipelineUri(name: string): vscode.Uri {
  return vscode.Uri.file(join(workspaceRoot(), "pipelines", name, "index.tsx"))
}

async function openPipeline(name: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(pipelineUri(name))
  return vscode.window.showTextDocument(doc)
}

let api: FlinkReactorApi

suite("FlinkReactor tap visualization (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  test("registers the tap commands", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.openTaps"))
    assert.ok(commands.includes("flinkReactor.toggleTapOverlay"))
  })

  // 7.1 — the panel lists the fixture's taps with strategy/schema/SQL.
  test("opens the panel and lists the tapped operators", async () => {
    await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")

    const info = await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.tapCount > 0,
    )
    // Explicit source + named Filter tap + auto-tapped Kafka sink.
    assert.strictEqual(info.tapCount, 3, "expected 3 tap entries")
    assert.strictEqual(info.autoTapCount, 1, "the sink is the only auto-tap")

    const manifest = api.taps.manifest()
    assert.ok(manifest, "the host should hold the pulled manifest")
    const filter = manifest.taps.find((t) => t.componentName === "Filter")
    assert.ok(filter, "the named Filter tap is listed")
    assert.strictEqual(filter.name, "filtered-orders")
    assert.strictEqual(filter.connectorType, "kafka") // → consumer-group-clone
    assert.ok(filter.schema.length > 0, "tapped schema present")
    assert.ok(
      filter.observationSql.includes("CREATE TEMPORARY TABLE"),
      "observation SQL present",
    )
    assert.ok(filter.consumerGroupId.length > 0, "consumer group resolved")
  })

  // 7.5 — an untapped pipeline (no taps, no sinks → null manifest) renders
  // the graceful empty state, not an error.
  test("shows the graceful empty state for an untapped pipeline", async () => {
    await openPipeline("untapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")

    const info = await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.tapCount === 0,
    )
    assert.strictEqual(info.ok, true, "empty taps are ok, not an error")
    assert.strictEqual(info.tapCount, 0)
  })

  // Singleton — re-invoking retargets rather than duplicating.
  test("re-invoking keeps a single tap panel", async () => {
    await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.tapCount === 3,
    )
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    await wait(1_000)
    let tapTabs = 0
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input as { viewType?: string } | undefined
        if ((input?.viewType ?? "").includes("flinkReactor.taps")) tapTabs++
        else if (tab.label.includes("Taps")) tapTabs++
      }
    }
    assert.strictEqual(tapTabs, 1, "exactly one tap panel")
  })

  // 7.3 — clicking a tap entry reveals + selects the operator's JSX.
  test("navigates from a tap to its JSX", async () => {
    await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.tapCount === 3,
    )

    const manifest = api.taps.manifest()
    const source = manifest?.taps.find((t) => t.componentName === "KafkaSource")
    assert.ok(source, "the tapped source is in the manifest")
    await api.taps.revealTap(source.nodeId)
    await wait(500)

    const editor = vscode.window.activeTextEditor
    assert.ok(editor, "an editor should be active after navigation")
    assert.ok(
      editor.document.uri.fsPath.endsWith(join("tapped", "index.tsx")),
      "the pipeline file should be focused",
    )
    assert.ok(
      editor.selection.start.line > 0,
      "selection should land on the tapped operator's JSX range",
    )
  })

  // 7.2 — adding a tap live-refreshes the panel with the new entry while
  // existing taps keep their identity (same nodeIds).
  test("live-refreshes when a tap is added", async () => {
    const editor = await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.tapCount === 3,
    )
    const before = api.taps.manifest()
    assert.ok(before)
    const beforeIds = new Set(before.taps.map((t) => t.nodeId))

    // Tap the sink explicitly: `tap={true}` replaces the dev auto-tap with an
    // explicit one (autoTap flips to false) — still 3 taps, 0 auto.
    const text = editor.document.getText()
    const at = text.indexOf("<KafkaSink ")
    assert.ok(at >= 0)
    await editor.edit((b) =>
      b.insert(editor.document.positionAt(at + "<KafkaSink ".length), "tap "),
    )

    const refreshed = await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.autoTapCount === 0,
    )
    assert.strictEqual(refreshed.tapCount, 3)
    const after = api.taps.manifest()
    assert.ok(after)
    // Stable identity: the explicit source + filter taps keep their nodeIds.
    for (const tap of after.taps.filter(
      (t) => t.componentName !== "KafkaSink",
    )) {
      assert.ok(beforeIds.has(tap.nodeId), `tap ${tap.nodeId} kept identity`)
    }

    // Revert for later tests.
    await editor.edit((b) =>
      b.delete(
        new vscode.Range(
          editor.document.positionAt(at + "<KafkaSink ".length),
          editor.document.positionAt(at + "<KafkaSink tap ".length),
        ),
      ),
    )
    await until(
      () => api.taps.renderInfo(),
      (r) => r.ok && r.autoTapCount === 1,
    )
  })

  // 7.4 — the DAG overlay marks tapped nodes and clears on toggle-off.
  test("toggles the tap overlay on the DAG", async () => {
    await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openGraph")
    await until(
      () => api.dag.renderInfo(),
      (r) => r.ok && r.nodeCount === 3,
    )

    await vscode.commands.executeCommand("flinkReactor.toggleTapOverlay")
    const applied = await until(
      () => api.taps.overlayInfo(),
      (o) => o.active && o.markedCount > 0,
    )
    assert.strictEqual(applied.markedCount, 3, "all three tapped nodes marked")

    await vscode.commands.executeCommand("flinkReactor.toggleTapOverlay")
    const cleared = await until(
      () => api.taps.overlayInfo(),
      (o) => !o.active && o.markedCount === 0,
    )
    assert.strictEqual(cleared.markedCount, 0, "markers cleared")
    // The graph itself is untouched.
    const dag = api.dag.renderInfo()
    assert.ok(dag?.ok && dag.nodeCount === 3, "graph still rendered")
  })

  // 7.6 — the console push target reflects flinkReactor.consoleUrl.
  test("shows the configured console push target", async () => {
    const cfg = vscode.workspace.getConfiguration("flinkReactor")
    await cfg.update(
      "consoleUrl",
      "http://localhost:4400",
      vscode.ConfigurationTarget.Workspace,
    )
    // The setting forwards over didChangeConfiguration; give it a beat, then
    // re-pull by re-running the command (retarget → refresh).
    await wait(750)
    await openPipeline("tapped")
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    const withUrl = await until(
      () => api.taps.manifest(),
      (m) => m.consoleUrl === "http://localhost:4400",
    )
    assert.strictEqual(withUrl.consoleUrl, "http://localhost:4400")

    await cfg.update(
      "consoleUrl",
      undefined,
      vscode.ConfigurationTarget.Workspace,
    )
    await wait(750)
    await vscode.commands.executeCommand("flinkReactor.openTaps")
    await until(
      () => api.taps.manifest(),
      (m) => m.consoleUrl === undefined,
    )
  })
})
