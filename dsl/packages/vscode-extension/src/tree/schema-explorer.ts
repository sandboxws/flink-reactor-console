// Schema Explorer tree (schema-navigation, Tier-2).
//
// A native VS Code `TreeDataProvider` projecting the active pipeline's sources
// and sinks (from the `flinkReactor/schemaTree` custom request) into a tree:
// top-level source/sink items, each expanding to its fields (`name: TYPE`, with
// a primary-key marker) and — for a source that declares one — a watermark
// child. Every item stores its `locationRef`; activation opens that declaration
// (the node JSX, or the `Schema()` field key) via the shared reveal command.
// Unresolvable items show a non-navigable marker and do nothing on activation.
//
// The provider is a dumb renderer of server-resolved data: it holds no DSL and
// re-requests the tree on the server's debounced re-synthesis signal (live
// refresh), keeping its last-good tables behind a stale indicator when the
// server is unavailable or synthesis is failing.

import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import { getOutputChannel } from "../ui/output.js"
import {
  SCHEMA_TREE_REQUEST,
  type SchemaTableInfo,
  type SchemaTreeField,
  type SchemaTreeLocation,
  type SchemaTreeResponse,
  type SchemaTreeWatermark,
} from "./protocol.js"

export const SCHEMA_VIEW_ID = "flinkReactor.schemaExplorer"
export const REVEAL_COMMAND = "flinkReactor.revealSchemaItem"
export const REFRESH_COMMAND = "flinkReactor.refreshSchemaExplorer"

/** A node in the Schema Explorer tree. */
export type SchemaTreeNode =
  | { readonly kind: "table"; readonly table: SchemaTableInfo }
  | {
      readonly kind: "field"
      readonly tableId: string
      readonly field: SchemaTreeField
    }
  | {
      readonly kind: "watermark"
      readonly tableId: string
      readonly watermark: SchemaTreeWatermark
      readonly locationRef?: SchemaTreeLocation
    }
  | { readonly kind: "message"; readonly text: string }

export class SchemaExplorerProvider
  implements vscode.TreeDataProvider<SchemaTreeNode>
{
  /** The live provider, for the extension API / e2e suite (the native tree's
   *  rendered items are not readable from the host). */
  static current: SchemaExplorerProvider | undefined

  private readonly changed = new vscode.EventEmitter<
    SchemaTreeNode | undefined
  >()
  readonly onDidChangeTreeData = this.changed.event

  private uri: string | undefined
  private tables: readonly SchemaTableInfo[] = []
  private stale = false
  private lastError: string | undefined

  // The client is read lazily: the view registers at activation before the
  // language server is started (and may have no server at all without a project).
  constructor(
    private readonly getClient: () => FlinkReactorClient | undefined,
  ) {
    SchemaExplorerProvider.current = this
  }

  /** Bind the tree to a pipeline document (re-bind on active-editor change) and
   *  refresh. A no-op when already bound to `uri`. */
  async bind(uri: string | undefined): Promise<void> {
    if (uri === this.uri) return
    this.uri = uri
    this.tables = []
    this.stale = false
    this.lastError = undefined
    await this.refresh()
  }

  /** Re-request `flinkReactor/schemaTree` for the bound document and re-render.
   *  Keeps the last-good tables (behind a stale flag) when the server is
   *  unavailable or synthesis is failing, so the view never blanks on a hiccup. */
  async refresh(): Promise<void> {
    if (!this.uri) {
      this.tables = []
      this.changed.fire(undefined)
      return
    }
    const response =
      await this.getClient()?.sendGraphRequest<SchemaTreeResponse>(
        SCHEMA_TREE_REQUEST,
        { uri: this.uri },
      )
    // Server unavailable (no client / not running) — fall back to the last-good
    // tables (the extension cannot synthesize on its own) marked stale.
    if (!response) {
      this.stale = this.tables.length > 0
      this.changed.fire(undefined)
      return
    }
    if (!response.ok) {
      this.stale = this.tables.length > 0
      this.lastError = response.error
      this.changed.fire(undefined)
      return
    }
    this.tables = response.tables
    this.stale = false
    this.lastError = undefined
    this.changed.fire(undefined)
  }

  // ── Extension API / e2e surface ─────────────────────────────────────
  get snapshot(): readonly SchemaTableInfo[] {
    return this.tables
  }
  get boundUri(): string | undefined {
    return this.uri
  }
  get isStale(): boolean {
    return this.stale
  }
  /** Drive the reveal path for a tree node by its stable id (the e2e cannot
   *  click the native tree). */
  async revealById(id: string): Promise<boolean> {
    const node = this.findById(id)
    if (!node) return false
    return revealNode(node)
  }

  // ── TreeDataProvider ────────────────────────────────────────────────
  getChildren(node?: SchemaTreeNode): SchemaTreeNode[] {
    if (!node) {
      if (this.tables.length === 0)
        return [{ kind: "message", text: this.emptyText() }]
      return this.tables.map((table) => ({ kind: "table", table }))
    }
    if (node.kind === "table") {
      const children: SchemaTreeNode[] = node.table.fields.map((field) => ({
        kind: "field",
        tableId: node.table.nodeId,
        field,
      }))
      if (node.table.watermark) {
        children.push({
          kind: "watermark",
          tableId: node.table.nodeId,
          watermark: node.table.watermark,
          // Reveal the source node for a watermark (it has no field key of its own).
          locationRef: node.table.locationRef,
        })
      }
      return children
    }
    return []
  }

  getTreeItem(node: SchemaTreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "message":
        return new vscode.TreeItem(
          node.text,
          vscode.TreeItemCollapsibleState.None,
        )
      case "table":
        return this.tableItem(node.table)
      case "field":
        return this.fieldItem(node)
      case "watermark":
        return this.watermarkItem(node)
    }
  }

  private tableItem(t: SchemaTableInfo): vscode.TreeItem {
    const item = new vscode.TreeItem(
      t.label,
      vscode.TreeItemCollapsibleState.Expanded,
    )
    // Stable id (the node id) so VS Code preserves expansion across refreshes.
    item.id = t.nodeId
    item.iconPath = new vscode.ThemeIcon(
      t.role === "source" ? "database" : "cloud-upload",
    )
    item.contextValue = `schemaTable:${t.role}`
    const suffix = this.stale ? " (stale)" : ""
    if (t.locationRef) {
      item.description = `${t.role} · ${t.component}${suffix}`
      item.command = revealCommand(t.locationRef, t.label)
    } else {
      // 6.4 — a node with no source location is shown but non-navigable.
      item.description = `${t.role} · ${t.component} · unresolved${suffix}`
      item.tooltip = "Source location unavailable (computed/unmapped node)"
    }
    return item
  }

  private fieldItem(node: {
    tableId: string
    field: SchemaTreeField
  }): vscode.TreeItem {
    const f = node.field
    const item = new vscode.TreeItem(
      f.name,
      vscode.TreeItemCollapsibleState.None,
    )
    item.id = `${node.tableId}:field:${f.name}`
    item.description = f.primaryKey ? `${f.type} · PK` : f.type
    item.iconPath = new vscode.ThemeIcon(f.primaryKey ? "key" : "symbol-field")
    item.contextValue = f.primaryKey ? "schemaField:pk" : "schemaField"
    if (f.locationRef) {
      item.command = revealCommand(f.locationRef, f.name)
    } else {
      item.tooltip = "Field declaration unavailable"
    }
    return item
  }

  private watermarkItem(node: {
    tableId: string
    watermark: SchemaTreeWatermark
    locationRef?: SchemaTreeLocation
  }): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `watermark: ${node.watermark.column}`,
      vscode.TreeItemCollapsibleState.None,
    )
    item.id = `${node.tableId}:watermark`
    item.description = node.watermark.expression
    item.iconPath = new vscode.ThemeIcon("watch")
    item.contextValue = "schemaWatermark"
    if (node.locationRef)
      item.command = revealCommand(node.locationRef, "watermark")
    return item
  }

  private emptyText(): string {
    if (this.lastError) return `Synthesis failed: ${this.lastError}`
    if (this.uri) return "No sources or sinks (waiting for synthesis)…"
    return "Open a FlinkReactor pipeline to view its schemas."
  }

  private findById(id: string): SchemaTreeNode | undefined {
    for (const table of this.tables) {
      if (table.nodeId === id) return { kind: "table", table }
      for (const field of table.fields) {
        if (`${table.nodeId}:field:${field.name}` === id)
          return { kind: "field", tableId: table.nodeId, field }
      }
      if (table.watermark && `${table.nodeId}:watermark` === id)
        return {
          kind: "watermark",
          tableId: table.nodeId,
          watermark: table.watermark,
          locationRef: table.locationRef,
        }
    }
    return undefined
  }

  dispose(): void {
    this.changed.dispose()
    if (SchemaExplorerProvider.current === this)
      SchemaExplorerProvider.current = undefined
  }
}

/** The click command for a tree item that has a resolvable location. */
function revealCommand(loc: SchemaTreeLocation, title: string): vscode.Command {
  return { command: REVEAL_COMMAND, title: `Reveal ${title}`, arguments: [loc] }
}

/**
 * Open a location's file and select its range — the command behind every
 * navigable tree item. A no-op (no error) when `loc` is absent so activating an
 * unresolvable item does nothing. Returns whether navigation occurred.
 */
export async function revealLocation(
  loc: SchemaTreeLocation | undefined,
): Promise<boolean> {
  if (!loc) return false
  const selection = new vscode.Range(
    loc.range.start.line,
    loc.range.start.character,
    loc.range.end.line,
    loc.range.end.character,
  )
  try {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(loc.uri),
    )
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
      selection,
    })
    editor.revealRange(
      selection,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    )
    return true
  } catch (err) {
    getOutputChannel().warn(
      `Could not reveal schema declaration: ${String(err)}`,
    )
    return false
  }
}

function revealNode(node: SchemaTreeNode): Promise<boolean> {
  const loc =
    node.kind === "table"
      ? node.table.locationRef
      : node.kind === "field"
        ? node.field.locationRef
        : node.kind === "watermark"
          ? node.locationRef
          : undefined
  return revealLocation(loc)
}
