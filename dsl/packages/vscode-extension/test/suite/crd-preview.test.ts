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

/** Poll an async getter until it resolves a value satisfying `predicate`. */
async function untilAsync<T>(
  get: () => Promise<T | undefined>,
  predicate: (v: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = await get()
    if (v !== undefined && predicate(v)) return v
    await wait(250)
  }
  throw new Error("file condition not met before timeout")
}

function pipelineUri(name: string): vscode.Uri {
  return vscode.Uri.file(join(workspaceRoot(), "pipelines", name, "index.tsx"))
}

/** Open a pipeline editor and open (or retarget) the CRD preview onto it. */
async function openPreviewFor(name: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(pipelineUri(name))
  const editor = await vscode.window.showTextDocument(doc)
  await vscode.commands.executeCommand("flinkReactor.openCrdPreview")
  return editor
}

let api: FlinkReactorApi

suite("FlinkReactor CRD preview (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  test("registers the openCrdPreview command", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.openCrdPreview"))
  })

  // 7.2 — a standard SQL pipeline shows a FlinkDeployment + ConfigMap tab set
  // and the standard-pipeline header label.
  test("opens a standard pipeline with FlinkDeployment + ConfigMap tabs", async () => {
    await openPreviewFor("orders")
    const info = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.tabCount > 0 && r.pipelineName === "orders",
    )
    assert.strictEqual(info.pipelineKind, "standard")

    const kinds = api.crdPreview.artifacts().map((a) => a.kind)
    const files = api.crdPreview.artifacts().map((a) => a.filename)
    assert.ok(kinds.includes("FlinkDeployment"), "a FlinkDeployment tab")
    assert.ok(kinds.includes("ConfigMap"), "a ConfigMap tab")
    assert.ok(files.includes("deployment.yaml"))
    assert.ok(files.includes("configmap.yaml"))
    assert.ok(api.crdPreview.isOpen(), "the panel is open")
  })

  // 7.3 — a CDC pipeline shows pipeline.yaml + configmap.yaml (no FlinkDeployment)
  // and the CDC header label. The singleton panel retargets onto it.
  test("retargets to a CDC pipeline with pipeline.yaml + configmap.yaml tabs", async () => {
    await openPreviewFor("cdc-orders")
    const info = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.tabCount > 0 && r.pipelineName === "cdc-orders",
    )
    assert.strictEqual(info.pipelineKind, "cdc-pipeline")

    const kinds = api.crdPreview.artifacts().map((a) => a.kind)
    const files = api.crdPreview.artifacts().map((a) => a.filename)
    assert.ok(files.includes("pipeline.yaml"), "a pipeline.yaml tab")
    assert.ok(files.includes("configmap.yaml"), "a configmap.yaml tab")
    assert.ok(
      !kinds.includes("FlinkDeployment"),
      "no FlinkDeployment tab for a CDC pipeline",
    )
  })

  // 7.4 — a live edit re-synthesizes; the affected artifact refreshes on the
  // next debounced pass and the active tab is preserved.
  test("refreshes on a live edit and preserves the active tab", async () => {
    const editor = await openPreviewFor("orders")
    const before = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.tabCount >= 2 && r.pipelineName === "orders",
    )

    // Select the second tab (the ConfigMap) and confirm it sticks.
    api.crdPreview.selectTab(1)
    await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.activeTab === 1,
    )

    // Bump the Filter threshold — a content change the server re-synthesizes;
    // the wrapping ConfigMap (it embeds the SQL) is the affected artifact. Match
    // the *current* value with a regex (other suites share this buffer and may
    // have already changed it) and restore it afterwards so the test is
    // order-independent and idempotent.
    const original = editor.document.getText()
    const match = /> (\d+)/.exec(original)
    assert.ok(
      match,
      "the Filter condition should contain a `> <number>` threshold",
    )
    const bumped = `> ${Number(match[1]) + 100}`
    await editor.edit((b) =>
      b.replace(
        new vscode.Range(
          editor.document.positionAt(match.index),
          editor.document.positionAt(match.index + match[0].length),
        ),
        bumped,
      ),
    )

    const after = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.version > before.version,
    )
    assert.ok(after.version > before.version, "preview re-rendered after edit")
    assert.strictEqual(after.activeTab, 1, "the active tab is preserved")

    // Restore the buffer so the fixture stays consistent for any later suite.
    await editor.edit((b) =>
      b.replace(
        new vscode.Range(
          editor.document.positionAt(match.index),
          editor.document.positionAt(match.index + bumped.length),
        ),
        match[0],
      ),
    )
  })

  // 7.5 — breaking synthesis keeps the last-good set behind a stale banner;
  // fixing it clears the banner.
  test("keeps last-good behind a stale banner, then recovers", async () => {
    const editor = await openPreviewFor("orders")
    await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.tabCount >= 2 && !r.stale,
    )

    // Break it: prepend a throwing statement (runs after the hoisted imports).
    await editor.edit((b) =>
      b.insert(new vscode.Position(0, 0), "throw new Error('boom')\n"),
    )
    const stale = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.stale,
    )
    assert.strictEqual(stale.stale, true, "stale banner is shown")
    assert.ok(
      stale.tabCount > 0,
      "last-good artifacts are retained, not blanked",
    )
    assert.ok(api.crdPreview.isOpen(), "the panel survives the error")

    // Fix it: delete the line we inserted, restoring the original buffer.
    await editor.edit((b) =>
      b.delete(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)),
      ),
    )
    const recovered = await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && !r.stale && r.tabCount >= 2,
    )
    assert.strictEqual(recovered.stale, false, "banner clears after the fix")
  })

  // 7.6 — save active + save all write dist/<pipeline>/ contents matching the
  // `fr synth` layout (deployment.yaml + configmap.yaml for a standard pipeline).
  test("save active + save all write the fr-synth dist layout", async () => {
    await openPreviewFor("orders")
    await until(
      () => api.crdPreview.renderInfo(),
      (r) => r.ok && r.tabCount >= 2 && r.pipelineName === "orders",
    )
    const distDir = vscode.Uri.file(join(workspaceRoot(), "dist", "orders"))
    try {
      await vscode.workspace.fs.delete(distDir, { recursive: true })
    } catch {
      // not present yet — fine.
    }

    // Save just the CRD (deployment.yaml).
    const crd = api.crdPreview
      .artifacts()
      .find((a) => a.kind === "FlinkDeployment")
    assert.ok(crd, "the FlinkDeployment artifact exists")
    await api.crdPreview.save(crd.id)
    const deployment = await untilAsync(
      () => readIfExists(vscode.Uri.joinPath(distDir, "deployment.yaml")),
      (s) => s.length > 0,
    )
    assert.ok(deployment.includes("kind: FlinkDeployment"))

    // Save the whole set — the ConfigMap lands alongside.
    await api.crdPreview.saveAll()
    const configMap = await untilAsync(
      () => readIfExists(vscode.Uri.joinPath(distDir, "configmap.yaml")),
      (s) => s.length > 0,
    )
    assert.ok(configMap.includes("kind: ConfigMap"))
    assert.ok(configMap.includes("pipeline.sql"))

    // Clean up the generated dist so it never gets committed.
    await vscode.workspace.fs.delete(distDir, { recursive: true })
  })
})

/** Read a file's text, or `undefined` if it does not exist yet. */
async function readIfExists(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri)
    return Buffer.from(bytes).toString("utf-8")
  } catch {
    return undefined
  }
}
