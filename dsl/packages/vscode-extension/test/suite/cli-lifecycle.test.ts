// cli-lifecycle-integration (Tier-3 feature 12) e2e: palette commands run
// the resolved workspace binary with constructed `-p`/`--env` argv, the
// CodeLens row scopes commands to its pipeline, a CLI diagnostic lands in
// the Problems panel and clears on a clean run, the environment selection
// scopes subsequent commands, and `fr dev` runs as a single managed task.
//
// The workspace `node_modules/.bin/flink-reactor` is a recording stub
// (written by `runTest.ts`): it appends each invocation's argv to
// `.fr-cli-invocations.log`, emits one matcher-shaped diagnostic from
// `validate` while `.fr-emit-diagnostic` exists, and blocks on `dev`.

import * as assert from "node:assert"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as vscode from "vscode"

const EXTENSION_ID = "flink-reactor.flink-reactor"

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0]
  assert.ok(folder, "expected an open workspace folder")
  return folder.uri.fsPath
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function until<T>(
  get: () => T | undefined,
  predicate: (v: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = get()
    if (v !== undefined && predicate(v)) return v
    await wait(250)
  }
  throw new Error("condition not met before timeout")
}

function invocationsLog(): string[] {
  const file = join(workspaceRoot(), ".fr-cli-invocations.log")
  if (!existsSync(file)) return []
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
}

function clearInvocations(): void {
  rmSync(join(workspaceRoot(), ".fr-cli-invocations.log"), { force: true })
}

function devExecutions(): readonly vscode.TaskExecution[] {
  return vscode.tasks.taskExecutions.filter(
    (e) =>
      e.task.definition.type === "flink-reactor" &&
      e.task.definition.verb === "dev",
  )
}

async function openPipeline(name: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(join(workspaceRoot(), "pipelines", name, "index.tsx")),
  )
  await vscode.window.showTextDocument(doc)
}

suite("FlinkReactor CLI lifecycle (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    await ext.activate()
    // Deterministic env state for the suite.
    await vscode.commands.executeCommand("flinkReactor.selectEnvironment", "")
  })

  teardown(async () => {
    clearInvocations()
    rmSync(join(workspaceRoot(), ".fr-emit-diagnostic"), { force: true })
    await vscode.commands.executeCommand("flinkReactor.selectEnvironment", "")
    // Stop a lingering dev watch so suites stay independent.
    for (const execution of devExecutions()) execution.terminate()
    await vscode.commands.executeCommand("workbench.action.closeAllEditors")
  })

  test("registers the lifecycle command set", async () => {
    const commands = await vscode.commands.getCommands(true)
    for (const verb of [
      "synth",
      "validate",
      "graph",
      "schema",
      "deploy",
      "up",
      "down",
      "status",
      "stop",
      "resume",
      "savepoint",
      "doctor",
      "dev",
      "selectEnvironment",
    ]) {
      assert.ok(
        commands.includes(`flinkReactor.${verb}`),
        `missing flinkReactor.${verb}`,
      )
    }
  })

  // 8.2 — palette Synth runs the resolved binary with -p (from the active
  // editor) and --env (from the selected environment).
  test("synth runs the workspace binary with -p and --env", async () => {
    await vscode.commands.executeCommand(
      "flinkReactor.selectEnvironment",
      "production",
    )
    await openPipeline("orders")
    await vscode.commands.executeCommand("flinkReactor.synth")
    const lines = await until(
      () => invocationsLog(),
      (l) => l.some((line) => line.startsWith("synth")),
    )
    const synthLine = lines.find((l) => l.startsWith("synth"))
    assert.strictEqual(synthLine, "synth -p orders --env production")
  })

  test("commands run without --env when no environment is selected", async () => {
    await openPipeline("orders")
    await vscode.commands.executeCommand("flinkReactor.graph")
    const lines = await until(
      () => invocationsLog(),
      (l) => l.some((line) => line.startsWith("graph")),
    )
    assert.strictEqual(
      lines.find((l) => l.startsWith("graph")),
      "graph -p orders",
    )
  })

  // 8.2 — the CodeLens row offers the five actions scoped to the pipeline.
  test("CodeLens row on a pipeline entry point runs scoped Synth", async () => {
    const uri = vscode.Uri.file(
      join(workspaceRoot(), "pipelines", "tapped", "index.tsx"),
    )
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      uri,
    )
    const ours = (lenses ?? []).filter((l) =>
      l.command?.command.startsWith("flinkReactor."),
    )
    const titles = ours.map((l) => l.command?.title ?? "")
    assert.ok(
      titles.some((t) => t.includes("Synth")),
      `lens row offers Synth (got: ${titles.join(", ")})`,
    )
    for (const expected of ["Validate", "Graph", "Deploy", "Run tests"]) {
      assert.ok(titles.includes(expected), `lens row offers ${expected}`)
    }
    // Every lens is scoped to the path-derived pipeline — no prompting.
    for (const lens of ours) {
      assert.deepStrictEqual(lens.command?.arguments, ["tapped"])
    }

    // Drive the Synth lens' command exactly as a click would.
    const synthLens = ours.find((l) => l.command?.title.includes("Synth"))
    assert.ok(synthLens?.command)
    await vscode.commands.executeCommand(
      synthLens.command.command,
      ...(synthLens.command.arguments ?? []),
    )
    const lines = await until(
      () => invocationsLog(),
      (l) => l.some((line) => line.startsWith("synth")),
    )
    assert.strictEqual(
      lines.find((l) => l.startsWith("synth")),
      "synth -p tapped",
    )
  })

  test("no lifecycle CodeLens on a non-entry-point file", async () => {
    const uri = vscode.Uri.file(join(workspaceRoot(), "schemas", "order.ts"))
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      uri,
    )
    const ours = (lenses ?? []).filter((l) =>
      l.command?.command.startsWith("flinkReactor."),
    )
    assert.strictEqual(ours.length, 0)
  })

  // 8.2 — a CLI diagnostic lands in the Problems panel via the
  // $flink-reactor matcher and clears on a clean run.
  test("validate diagnostics land in the Problems panel and clear on a clean run", async () => {
    writeFileSync(join(workspaceRoot(), ".fr-emit-diagnostic"), "1")
    const target = vscode.Uri.file(
      join(workspaceRoot(), "pipelines", "orders", "index.tsx"),
    )
    await openPipeline("orders")
    await vscode.commands.executeCommand("flinkReactor.validate")

    // The CLI channel's own source — distinct from the LSP's "flink-reactor"
    // (the spec's no-double-reporting guarantee; this filter proves it).
    const fromCli = () =>
      vscode.languages
        .getDiagnostics(target)
        .filter((d) => String(d.source) === "flink-reactor-cli")
    const present = await until(
      () => fromCli(),
      (diags) => diags.length === 1,
    )
    const diag = present[0]
    assert.ok(diag)
    assert.strictEqual(diag.range.start.line, 12) // 13 in the 1-based output
    assert.match(diag.message, /stub diagnostic from validate/)
    assert.strictEqual(
      typeof diag.code === "object" ? diag.code.value : diag.code,
      "FR-TEST-001",
    )

    // Clean run: the stub emits nothing without the marker → entries clear.
    rmSync(join(workspaceRoot(), ".fr-emit-diagnostic"), { force: true })
    await vscode.commands.executeCommand("flinkReactor.validate")
    await until(
      () => fromCli(),
      (diags) => diags.length === 0,
    )
  })

  // 8.2 — fr dev: one managed task; re-invocation reveals rather than
  // spawning a second; stop terminates and clears.
  test("dev runs as a single managed task and stop terminates it", async () => {
    await vscode.commands.executeCommand("flinkReactor.dev")
    await until(
      () => devExecutions(),
      (executions) => executions.length === 1,
    )
    await until(
      () => invocationsLog(),
      (l) => l.some((line) => line.startsWith("dev")),
    )

    // Re-invoking reveals the existing managed task — no second instance.
    await vscode.commands.executeCommand("flinkReactor.dev")
    await wait(1_000)
    assert.strictEqual(devExecutions().length, 1)
    assert.strictEqual(
      invocationsLog().filter((l) => l.startsWith("dev")).length,
      1,
      "a second dev process was spawned",
    )

    await vscode.commands.executeCommand("flinkReactor.stopDev")
    await until(
      () => devExecutions(),
      (executions) => executions.length === 0,
    )
  })
})
