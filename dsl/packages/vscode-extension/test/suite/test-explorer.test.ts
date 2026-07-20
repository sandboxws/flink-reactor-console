// test-explorer (Tier-3 feature 16) e2e: filesystem discovery grouped by
// pipeline with describe/it children + snapshot tags, real Vitest runs with
// per-test outcomes, the SQL golden-diff opening for the failed SQL snapshot
// only, snapshot blessing via --update (rewritten file + passing re-run +
// closed diff), continuous watch, and the missing-Vitest degradation — all
// observed through the extension API (the Test API exposes no cross-
// extension item enumeration).

import * as assert from "node:assert"
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
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

async function until<T>(
  get: () => T | undefined,
  predicate: (v: T) => boolean,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = get()
    if (v !== undefined && predicate(v)) return v
    await wait(300)
  }
  throw new Error("condition not met before timeout")
}

function testFileUri(name: string): vscode.Uri {
  return vscode.Uri.file(
    join(workspaceRoot(), "tests", "pipelines", `${name}.test.ts`),
  )
}

function outcomeOf(api: FlinkReactorApi, idSuffix: string): string | undefined {
  for (const [id, state] of api.tests.outcomes()) {
    if (id.endsWith(idSuffix)) return state
  }
  return undefined
}

let api: FlinkReactorApi

suite("FlinkReactor test explorer (e2e)", function () {
  this.timeout(300_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  teardown(async () => {
    api.tests.stopWatch()
    await vscode.commands.executeCommand("workbench.action.closeAllEditors")
  })

  // 11.2 — discovery groups by pipeline, exposes it children with ranges and
  // snapshot tags, and re-discovers on add/delete.
  test("discovers pipeline tests grouped with tagged children", async () => {
    api.tests.refresh()
    const items = await until(
      () => api.tests.items(),
      (list) => list.some((i) => i.id === "pipeline:orders"),
    )
    assert.ok(items.some((i) => i.id === "pipeline:tapped"))

    const sqlSnapshotTest = items.find((i) =>
      i.id.endsWith("#orders pipeline > synthesizes stable SQL"),
    )
    assert.ok(sqlSnapshotTest, "the template it() is discovered")
    assert.ok(typeof sqlSnapshotTest.line === "number", "carries a range")
    assert.ok(sqlSnapshotTest.tags.includes("snapshot"))
    assert.ok(sqlSnapshotTest.tags.includes("sqlSnapshot"))

    const plainTest = items.find((i) =>
      i.id.endsWith("#orders pipeline > contains load-bearing SQL"),
    )
    assert.ok(plainTest)
    assert.ok(!plainTest.tags.includes("snapshot"))

    const objectSnapshot = items.find((i) =>
      i.id.endsWith("#orders pipeline > snapshots the deployment kind"),
    )
    assert.ok(objectSnapshot?.tags.includes("snapshot"))
    assert.ok(!objectSnapshot?.tags.includes("sqlSnapshot"))
  })

  test("re-discovers on test-file create and delete", async () => {
    const extra = join(workspaceRoot(), "tests", "pipelines", "extra.test.ts")
    writeFileSync(
      extra,
      `import { describe, expect, it } from "vitest"
describe("extra pipeline", () => {
  it("exists", () => {
    expect(1).toBe(1)
  })
})
`,
    )
    await until(
      () => api.tests.items(),
      (list) => list.some((i) => i.id === "pipeline:extra"),
    )
    rmSync(extra)
    await until(
      () => api.tests.items(),
      (list) => !list.some((i) => i.id === "pipeline:extra"),
    )
  })

  // 11.3/11.4 — a real Vitest run maps per-test outcomes.
  test("runs a file and maps mixed pass/fail outcomes", async () => {
    await api.tests.run(testFileUri("orders"))
    assert.strictEqual(
      outcomeOf(api, "#orders pipeline > contains load-bearing SQL"),
      "pass",
    )
    assert.strictEqual(
      outcomeOf(api, "#orders pipeline > synthesizes stable SQL"),
      "fail",
    )
    assert.strictEqual(
      outcomeOf(api, "#orders pipeline > flags a missing token"),
      "fail",
    )
    assert.strictEqual(
      outcomeOf(api, "#orders pipeline > snapshots the deployment kind"),
      "fail",
    )
  })

  // 11.5 — the golden diff opens for the failed SQL snapshot ONLY.
  test("opens the SQL golden diff for the failed SQL snapshot only", async () => {
    await api.tests.run(testFileUri("orders"))
    const items = api.tests.items()
    const sqlTest = items.find((i) =>
      i.id.endsWith("#orders pipeline > synthesizes stable SQL"),
    )
    assert.ok(sqlTest)
    await vscode.commands.executeCommand(
      "flinkReactor.openSqlGoldenDiff",
      sqlTest.id,
    )
    const diffTab = await until(
      () => activeDiffTab(),
      (tab) => tab !== null,
    )
    assert.ok(diffTab, "a diff editor opened")

    // The received side carries the freshly generated SQL.
    const received = await vscode.workspace.openTextDocument(
      vscode.Uri.from({
        scheme: "flinkreactor-sql-diff",
        path: "/received.sql",
        query: encodeURIComponent(sqlTest.id),
      }),
    )
    assert.match(received.getText(), /INSERT INTO/)
    const expected = await vscode.workspace.openTextDocument(
      vscode.Uri.from({
        scheme: "flinkreactor-sql-diff",
        path: "/expected.sql",
        query: encodeURIComponent(sqlTest.id),
      }),
    )
    assert.match(expected.getText(), /STALE SNAPSHOT/)

    // The non-SQL (object) snapshot failure does NOT get a golden diff.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors")
    const crdTest = items.find((i) =>
      i.id.endsWith("#orders pipeline > snapshots the deployment kind"),
    )
    assert.ok(crdTest)
    await vscode.commands.executeCommand(
      "flinkReactor.openSqlGoldenDiff",
      crdTest.id,
    )
    await wait(750)
    assert.strictEqual(activeDiffTab(), null, "no diff for non-SQL snapshots")
  })

  // 11.6 — Update snapshots: the .snap rewrites, the test re-reports passing,
  // and the open golden diff closes.
  test("update snapshots blesses the change and closes the diff", async () => {
    const snapPath = join(
      workspaceRoot(),
      "tests",
      "pipelines",
      "__snapshots__",
      "orders.test.ts.snap",
    )
    const before = readFileSync(snapPath, "utf8")
    assert.match(before, /STALE SNAPSHOT/)

    await api.tests.run(testFileUri("orders"))
    const sqlTest = api.tests
      .items()
      .find((i) => i.id.endsWith("#orders pipeline > synthesizes stable SQL"))
    assert.ok(sqlTest)
    await vscode.commands.executeCommand(
      "flinkReactor.openSqlGoldenDiff",
      sqlTest.id,
    )
    await until(
      () => activeDiffTab(),
      (tab) => tab !== null,
    )

    await api.tests.updateSnapshots(
      testFileUri("orders"),
      "orders pipeline > synthesizes stable SQL",
    )
    const after = readFileSync(snapPath, "utf8")
    assert.ok(!after.includes("STALE SNAPSHOT"), "the snapshot was rewritten")
    assert.match(after, /INSERT INTO/)
    assert.strictEqual(
      outcomeOf(api, "#orders pipeline > synthesizes stable SQL"),
      "pass",
    )
    await until(
      () => activeDiffTab() === null,
      (closed) => closed === true,
    )
  })

  // 11.7 — watch: starts once, re-runs on edit, stop terminates.
  test("watch re-runs on edit and stops on demand", async () => {
    await api.tests.run(testFileUri("tapped"))
    assert.strictEqual(
      outcomeOf(api, "#tapped pipeline > contains load-bearing SQL"),
      "pass",
    )

    api.tests.startWatch()
    await until(
      () => api.tests.watchActive(),
      (active) => active === true,
    )

    // Edit the test to a failing assertion — watch re-runs it.
    const file = testFileUri("tapped").fsPath
    const original = readFileSync(file, "utf8")
    writeFileSync(
      file,
      original.replace("/CREATE TABLE/", "/WATCH_TOKEN_MISSING/"),
    )
    try {
      await until(
        () => outcomeOf(api, "#tapped pipeline > contains load-bearing SQL"),
        (state) => state === "fail",
        120_000,
      )
    } finally {
      writeFileSync(file, original)
    }

    api.tests.stopWatch()
    await until(
      () => api.tests.watchActive(),
      (active) => active === false,
    )
  })

  // 11.8 — missing Vitest: discovery still lists; a run errors with the reason.
  test("degrades gracefully when Vitest is not installed", async () => {
    const vitestDir = join(workspaceRoot(), "node_modules", "vitest")
    renameSync(vitestDir, `${vitestDir}.hidden`)
    try {
      api.tests.refresh()
      const items = await until(
        () => api.tests.items(),
        (list) => list.some((i) => i.id === "pipeline:orders"),
      )
      assert.ok(items.length > 0, "discovery lists files without Vitest")

      await api.tests.run(testFileUri("orders"))
      assert.strictEqual(
        outcomeOf(api, "#orders pipeline > synthesizes stable SQL"),
        "errored",
      )
    } finally {
      renameSync(`${vitestDir}.hidden`, vitestDir)
    }
  })
})

function activeDiffTab(): vscode.Tab | null {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (
        tab.input instanceof vscode.TabInputTextDiff &&
        tab.input.original.scheme === "flinkreactor-sql-diff"
      ) {
        return tab
      }
    }
  }
  return null
}
