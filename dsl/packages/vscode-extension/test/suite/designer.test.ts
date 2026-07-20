// visual-designer (Tier-3 feature 15) e2e: read-only view of an arbitrary
// pipeline, scalar literal-prop edits, read-only refusals with "Edit in
// source" semantics, pragma-gated structural edits honoring hierarchy rules,
// greenfield generation determinism, and rollback of a non-round-tripping
// edit — all driven through the extension API (the sandboxed webview cannot
// be clicked from the host; `api.designer.applyEdit` IS the message path the
// webview posts).

import * as assert from "node:assert"
import { join } from "node:path"
import * as vscode from "vscode"
import type { DesignerEdit } from "../../src/designer/protocol"
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

function pipelineUri(name: string): vscode.Uri {
  return vscode.Uri.file(join(workspaceRoot(), "pipelines", name, "index.tsx"))
}

async function openPipeline(name: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(pipelineUri(name))
  return vscode.window.showTextDocument(doc)
}

async function openDesignerFor(
  name: string,
  expectedNodes?: number,
): Promise<void> {
  await openPipeline(name)
  await vscode.commands.executeCommand("flinkReactor.openDesigner")
  await until(
    () => api.designer.model(),
    (m) =>
      m.ok &&
      (expectedNodes === undefined
        ? m.nodes.length > 0
        : m.nodes.length === expectedNodes),
  )
}

let api: FlinkReactorApi

suite("FlinkReactor visual designer (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  teardown(async () => {
    // Revert designer writes deterministically (the active-editor heuristic
    // raced: a dirty buffer left by one test shifted node ids for the next).
    for (const name of ["designer-arbitrary", "designer-managed"]) {
      const doc = await vscode.workspace.openTextDocument(pipelineUri(name))
      if (doc.isDirty) {
        await vscode.window.showTextDocument(doc, { preserveFocus: false })
        await vscode.commands.executeCommand("workbench.action.files.revert")
      }
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors")
  })

  test("registers the designer command", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.openDesigner"))
  })

  // 10.1 — arbitrary pipeline: read-only view renders, literal prop edits,
  // computed prop is read-only, structural edit refused with a reason.
  test("renders an arbitrary pipeline read-only with per-prop classification", async () => {
    await openDesignerFor("designer-arbitrary")
    const model = api.designer.model()
    assert.ok(model?.ok)
    assert.strictEqual(model.fileKind, "arbitrary")
    assert.ok(model.fileKindReason, "arbitrary file carries the matrix reason")

    const source = model.nodes.find((n) => n.component === "KafkaSource")
    assert.ok(source, "KafkaSource node present")
    const props = new Map(source.props.map((p) => [p.name, p]))
    assert.strictEqual(props.get("topic")?.classification, "editable")
    assert.strictEqual(props.get("topic")?.value, "orders")
    assert.ok(props.get("topic")?.range, "editable prop carries its range")
    assert.strictEqual(props.get("format")?.classification, "readOnly")
    assert.strictEqual(props.get("schema")?.classification, "readOnly")

    const render = await until(
      () => api.designer.renderInfo(),
      (r) => r.ok && r.nodeCount === model.nodes.length,
    )
    assert.ok(render.ok)
  })

  test("applies a scalar literal-prop edit through an undoable WorkspaceEdit", async () => {
    await openDesignerFor("designer-arbitrary")
    const outcome = await api.designer.applyEdit({
      kind: "scalarProp",
      nodeId: "orders",
      prop: "topic",
      value: "payments",
    })
    assert.ok(outcome?.ok, `edit should apply: ${JSON.stringify(outcome)}`)

    const doc = await vscode.workspace.openTextDocument(
      pipelineUri("designer-arbitrary"),
    )
    assert.ok(doc.getText().includes('topic="payments"'))
    // The computed prop and everything else is untouched.
    assert.ok(doc.getText().includes("format={FORMATS[wireKey]}"))
    // Undoable: revert restores the fixture (isDirty = not yet saved).
    assert.ok(doc.isDirty, "designer write lands as an unsaved workspace edit")
  })

  test("refuses editing a computed prop and a structural edit on an arbitrary file", async () => {
    await openDesignerFor("designer-arbitrary")

    const computed = await api.designer.applyEdit({
      kind: "scalarProp",
      nodeId: "orders",
      prop: "format",
      value: "json",
    })
    assert.strictEqual(computed?.ok, false)
    assert.match(computed?.refusedReason ?? "", /read-only|Edit in source/i)

    const structural = await api.designer.applyEdit({
      kind: "structural",
      edit: {
        op: "addNode",
        component: "Filter",
        props: { condition: "amount > 1" },
        parentId: null,
      },
    })
    assert.strictEqual(structural?.ok, false)
    assert.match(structural?.refusedReason ?? "", /designer-managed/i)

    // No write happened: the document is untouched on disk and in buffer.
    const doc = await vscode.workspace.openTextDocument(
      pipelineUri("designer-arbitrary"),
    )
    assert.strictEqual(doc.isDirty, false)
  })

  // 10.2 — designer-managed fixture: structural edits succeed + hierarchy.
  test("adds and deletes nodes in a designer-managed file", async () => {
    await openDesignerFor("designer-managed")
    assert.strictEqual(api.designer.model()?.fileKind, "designer-managed")

    const added = await api.designer.applyEdit({
      kind: "structural",
      edit: {
        op: "addNode",
        component: "Filter",
        props: { condition: "amount > 500" },
        parentId: null,
        index: 2,
      },
    })
    assert.ok(added?.ok, `addNode should apply: ${JSON.stringify(added)}`)
    const doc = await vscode.workspace.openTextDocument(
      pipelineUri("designer-managed"),
    )
    assert.ok(doc.getText().includes('<Filter condition="amount > 500" />'))

    // The canvas re-renders from re-synthesis (no optimistic state).
    const model = await until(
      () => api.designer.model(),
      (m) =>
        m.ok && m.nodes.filter((n) => n.component === "Filter").length === 2,
    )

    const newFilter = model.nodes.filter((n) => n.component === "Filter")[1]
    assert.ok(newFilter)
    const deleted = await api.designer.applyEdit({
      kind: "structural",
      edit: { op: "deleteNode", nodeId: newFilter.id },
    })
    assert.ok(
      deleted?.ok,
      `deleteNode should apply: ${JSON.stringify(deleted)}`,
    )
  })

  test("refuses a hierarchy-violating structural placement", async () => {
    // The pristine fixture has exactly 3 canvas nodes (source/filter/sink) —
    // waiting for that count guarantees the model reflects the reverted file.
    await openDesignerFor("designer-managed", 3)
    const outcome = await api.designer.applyEdit({
      kind: "structural",
      edit: {
        op: "addNode",
        component: "Route.Branch",
        props: { condition: "amount > 0" },
        parentId: null,
      },
    })
    assert.strictEqual(outcome?.ok, false)
    assert.match(outcome?.refusedReason ?? "", /hierarchy rules/i)
  })

  // 10.3 — greenfield generation: deterministic output that synthesizes
  // (full synthesis assertion lives in the language-server unit tests).
  test("generates a deterministic greenfield pipeline", async () => {
    await openDesignerFor("designer-managed")
    const canvas: DesignerEdit = {
      kind: "generate",
      pipelineName: "designed-e2e",
      nodes: [
        {
          component: "KafkaSource",
          props: { topic: "orders", bootstrapServers: "kafka:9092" },
          identifierProps: {
            schema: {
              identifier: "OrderSchema",
              importFrom: "@/schemas/order",
            },
          },
        },
        { component: "Filter", props: { condition: "amount > 100" } },
        {
          component: "GenericSink",
          props: { connector: "print", name: "out" },
        },
      ],
    }
    const first = await api.designer.applyEdit(canvas)
    assert.ok(first?.ok, `generate should verify: ${JSON.stringify(first)}`)
    assert.ok(first?.newFileContent?.includes("// @flink-reactor designer"))
    assert.ok(first?.newFileContent?.includes('<Pipeline name="designed-e2e">'))

    const second = await api.designer.applyEdit(canvas)
    assert.strictEqual(
      first?.newFileContent,
      second?.newFileContent,
      "the same canvas generates byte-identical output",
    )
  })

  // 10.4 — a non-round-tripping edit rolls back, leaving the file unchanged.
  test("rolls back a synthesis-breaking edit and leaves the file unchanged", async () => {
    await openDesignerFor("designer-arbitrary", 3)
    // The Pipeline container is hidden from the canvas model, so its id is
    // addressed directly: creation order in the fixture pins it to
    // `Pipeline_3` (orders → 1, Filter_1 → 2, out → 3, Pipeline_3). The
    // `stateTtl` literal flows through the CRD generator's `toMilliseconds`,
    // which throws on a malformed duration — re-synthesis fails → rollback.
    const before = (
      await vscode.workspace.openTextDocument(pipelineUri("designer-arbitrary"))
    ).getText()

    const outcome = await api.designer.applyEdit({
      kind: "scalarProp",
      nodeId: "Pipeline_3",
      prop: "stateTtl",
      value: "bogus-duration",
    })
    assert.strictEqual(outcome?.ok, false)
    assert.match(
      outcome?.refusedReason ?? "",
      /rolled back|could not be located/i,
    )

    const after = (
      await vscode.workspace.openTextDocument(pipelineUri("designer-arbitrary"))
    ).getText()
    assert.strictEqual(after, before, "the file is exactly as it was")
  })
})
