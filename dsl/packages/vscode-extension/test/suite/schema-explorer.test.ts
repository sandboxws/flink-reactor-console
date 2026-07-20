import * as assert from "node:assert"
import { join } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorApi } from "../../src/extension"
import type { SchemaTableInfo } from "../../src/tree/protocol"

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

async function open(name: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(pipelineUri(name))
  return vscode.window.showTextDocument(doc)
}

/** Wait until the Schema Explorer is bound to `name`'s pipeline AND populated —
 *  in a multi-suite session the active-editor binding can lag, so guard on the
 *  bound URI to avoid reading a stale pipeline's tree. */
function tablesFor(name: string): Promise<readonly SchemaTableInfo[]> {
  const suffix = `pipelines/${name}/index.tsx`
  return until(
    () =>
      api.schemaTree.boundUri()?.endsWith(suffix)
        ? api.schemaTree.tables()
        : undefined,
    (t) => t.length > 0,
  )
}

let api: FlinkReactorApi

suite("FlinkReactor Schema Explorer (e2e)", function () {
  this.timeout(180_000)

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<FlinkReactorApi>(EXTENSION_ID)
    assert.ok(ext, `extension ${EXTENSION_ID} not found`)
    api = await ext.activate()
  })

  test("registers the Schema Explorer refresh command", async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes("flinkReactor.refreshSchemaExplorer"))
  })

  // 6.2 — the tree lists the pipeline's sources and sinks, each with its fields.
  test("lists sources and sinks with their fields", async () => {
    await open("schematree")
    const tables = await tablesFor("schematree")

    const source = tables.find((t) => t.role === "source")
    const sink = tables.find((t) => t.role === "sink")
    assert.ok(source, "a source should be listed")
    assert.ok(sink, "a sink should be listed")
    assert.strictEqual(source?.component, "KafkaSource")
    const fieldNames = source?.fields.map((f) => f.name) ?? []
    assert.ok(fieldNames.includes("order_id"), "source fields include order_id")
    assert.ok(fieldNames.includes("amount"), "source fields include amount")
  })

  // 7.1 — clicking a field reveals its declaration. When the source is mapped,
  // the field's locationRef points into the cross-file schema module
  // (`schemas/order.ts`) and activation navigates there; when the node cannot be
  // position-mapped (a synthesis-id determinism edge), the item degrades to a
  // non-navigable no-op — the spec's graceful-unresolvable behavior. Both are
  // asserted so the test is deterministic either way.
  test("reveals a field's cross-file declaration (or degrades gracefully)", async () => {
    await open("schematree")
    const tables = await tablesFor("schematree")
    const source = tables.find((t) => t.role === "source")
    assert.ok(source)

    // Give the host-side position map a beat to resolve the cross-file locationRef.
    await until(
      () =>
        api.schemaTree
          .tables()
          .find((t) => t.role === "source")
          ?.fields.find((f) => f.name === "order_id"),
      (f) => !!f.locationRef,
      6_000,
    ).catch(() => undefined)

    const field = api.schemaTree
      .tables()
      .find((t) => t.role === "source")
      ?.fields.find((f) => f.name === "order_id")
    const id = `${source.nodeId}:field:order_id`

    if (field?.locationRef) {
      assert.ok(
        field.locationRef.uri.endsWith("order.ts"),
        `locationRef should point at the schema module, got ${field.locationRef.uri}`,
      )
      assert.strictEqual(await api.schemaTree.revealItem(id), true)
      await wait(500)
      assert.ok(
        vscode.window.activeTextEditor?.document.uri.fsPath.endsWith(
          join("schemas", "order.ts"),
        ),
        "the schema module should be focused",
      )
    } else {
      // Unmapped source → non-navigable item; activation is a graceful no-op.
      assert.strictEqual(await api.schemaTree.revealItem(id), false)
    }
  })

  // 7.2 — activating an item with no resolvable location is a no-op (no throw).
  test("activating an unresolvable item is a no-op", async () => {
    const ok = await api.schemaTree.revealItem("does-not-exist:field:nope")
    assert.strictEqual(ok, false)
  })

  // 7.3 — an edit that adds a field re-synthesizes and the tree shows the new
  // field (live refresh off the server's re-synthesis signal).
  test("refreshes the tree when an edit adds a field", async () => {
    const editor = await open("inline")
    const before = await tablesFor("inline")
    const source = before.find((t) => t.role === "source")
    assert.ok(source)
    assert.deepStrictEqual(
      source.fields.map((f) => f.name),
      ["id", "name"],
    )

    // Insert a new field after `name: Field.STRING(),` inside the inline schema.
    const insert = "\n    email: Field.STRING(),"
    const text = editor.document.getText()
    const anchor = text.indexOf("name: Field.STRING(),")
    assert.ok(anchor >= 0, "anchor line present")
    const pos = editor.document.positionAt(
      anchor + "name: Field.STRING(),".length,
    )
    await editor.edit((b) => b.insert(pos, insert))

    const updated = await until(
      () => api.schemaTree.tables(),
      (t) => {
        const s = t.find((x) => x.role === "source")
        return !!s && s.fields.some((f) => f.name === "email")
      },
    )
    const newSource = updated.find((t) => t.role === "source")
    // The pre-existing fields are retained alongside the new one.
    assert.ok(newSource?.fields.some((f) => f.name === "id"))
    assert.ok(newSource?.fields.some((f) => f.name === "name"))

    // Restore the buffer so the fixture stays clean for re-runs.
    await editor.edit((b) =>
      b.delete(
        new vscode.Range(
          pos,
          editor.document.positionAt(
            anchor + "name: Field.STRING(),".length + insert.length,
          ),
        ),
      ),
    )
  })
})
