import * as assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"

const EXTENSION_ID = "flink-reactor.flink-reactor"

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0]
  assert.ok(folder, "expected an open workspace folder")
  return folder.uri.fsPath
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Diagnostic codes may be a string, number, or `{ value, target }`. */
function codeOf(d: vscode.Diagnostic): string {
  const c = d.code
  if (c && typeof c === "object" && "value" in c) return String(c.value)
  return String(c)
}

suite("FlinkReactor extension (e2e)", function () {
  this.timeout(180_000)

  test("activates in a FlinkReactor project", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    await ext.activate()
    assert.ok(ext.isActive, "extension should be active")
  })

  test("registers its commands", async () => {
    const commands = await vscode.commands.getCommands(true)
    for (const id of [
      "flinkReactor.configureTsPlugin",
      "flinkReactor.useWorkspaceTypeScript",
      "flinkReactor.restartServer",
      "flinkReactor.showOutput",
    ]) {
      assert.ok(commands.includes(id), `missing command ${id}`)
    }
  })

  test("auto-configures the ts-plugin in tsconfig.json", async () => {
    const tsconfigPath = join(workspaceRoot(), "tsconfig.json")
    await vscode.commands.executeCommand("flinkReactor.configureTsPlugin")
    await wait(1_500)
    const text = readFileSync(tsconfigPath, "utf-8")
    assert.ok(
      text.includes("@flink-reactor/ts-plugin"),
      "tsconfig should list the ts-plugin",
    )
    assert.ok(
      text.includes('"jsxImportSource"') && text.includes("@flink-reactor/dsl"),
      "tsconfig should set jsxImportSource",
    )
  })

  test("publishes an FR diagnostic for the fixture pipeline", async () => {
    const pipeline = vscode.Uri.file(
      join(workspaceRoot(), "pipelines", "orders", "index.tsx"),
    )
    const doc = await vscode.workspace.openTextDocument(pipeline)
    await vscode.window.showTextDocument(doc)

    // Synthesis is debounced and runs in a cold-started isolation worker, so
    // poll until an FR-coded diagnostic appears.
    let frDiagnostics: vscode.Diagnostic[] = []
    for (let i = 0; i < 90; i++) {
      await wait(1_000)
      frDiagnostics = vscode.languages
        .getDiagnostics(pipeline)
        .filter((d) => codeOf(d).startsWith("FR"))
      if (frDiagnostics.length > 0) break
    }
    assert.ok(
      frDiagnostics.length > 0,
      "expected at least one FR-coded diagnostic from the language server",
    )
  })
})
