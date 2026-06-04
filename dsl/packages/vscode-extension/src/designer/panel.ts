import { basename } from "node:path"
import { PROP_FORM_SCHEMA } from "@flink-reactor/language-server/prop-form-schema"
import {
  COMPONENT_CHILDREN,
  DSL_COMPONENTS,
} from "@flink-reactor/ts-plugin/rules"
import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import { NODE_RANGE_REQUEST, type NodeRangeResult } from "../graph/protocol.js"
import { getOutputChannel } from "../ui/output.js"
import { buildDesignerHtml, getNonce } from "./html.js"
import {
  APPLY_DESIGNER_EDIT_REQUEST,
  type ApplyDesignerEditResponse,
  type CanvasNode,
  DESIGNER_MODEL_REQUEST,
  type DesignerEdit,
  type DesignerModelResponse,
  type DesignerStaticData,
  type PaletteGroup,
} from "./protocol.js"

/** Messages the designer webview posts back to the extension host. */
type InboundMessage =
  | { readonly type: "requestRefresh" }
  | {
      readonly type: "rendered"
      readonly ok: boolean
      readonly version: number
      readonly nodeCount: number
    }
  | { readonly type: "revealNode"; readonly nodeId: string }
  | { readonly type: "applyEdit"; readonly edit: DesignerEdit }
  | { readonly type: "generateDraft"; readonly nodes: readonly CanvasNode[] }

/** What the webview last drew — exposed for the e2e suite. */
export interface DesignerRenderInfo {
  readonly ok: boolean
  readonly version: number
  readonly nodeCount: number
}

/** The last `applyDesignerEdit` outcome — exposed for the e2e suite (the
 *  sandboxed webview's refusal strip is unreadable from the host). */
export interface DesignerEditOutcome {
  readonly ok: boolean
  readonly refusedReason?: string
  readonly error?: string
  /** For `generate` edits: the verified file content the server printed. */
  readonly newFileContent?: string
}

/**
 * The singleton "Pipeline Designer" webview panel. Owns one webview beside
 * the editor, brokers all LSP traffic (the webview never holds the client),
 * posts the static palette/rules/prop-form-schema data once per load, pulls
 * the designer model on demand + on each debounced re-synthesis, and applies
 * every committed designer write as an undoable `WorkspaceEdit`. The webview
 * holds no authoritative state: after any applied write the server
 * re-synthesizes and the canvas re-renders from the new model.
 */
export class DesignerPanel {
  public static readonly viewType = "flinkReactor.designer"
  private static instance: DesignerPanel | undefined

  private readonly disposables: vscode.Disposable[] = []
  private renderedVersion = -1
  private lastRender: DesignerRenderInfo | undefined
  private lastEdit: DesignerEditOutcome | undefined
  private lastModel: DesignerModelResponse | undefined

  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    if (DesignerPanel.instance) {
      DesignerPanel.instance.retarget(uri)
      DesignerPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      DesignerPanel.viewType,
      "Pipeline Designer",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    )
    DesignerPanel.instance = new DesignerPanel(panel, extensionUri, client, uri)
  }

  static get active(): DesignerPanel | undefined {
    return DesignerPanel.instance
  }

  get render(): DesignerRenderInfo | undefined {
    return this.lastRender
  }

  get lastEditOutcome(): DesignerEditOutcome | undefined {
    return this.lastEdit
  }

  get model(): DesignerModelResponse | undefined {
    return this.lastModel
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly client: FlinkReactorClient,
    private uri: string,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "designer.js"),
    )
    panel.webview.html = buildDesignerHtml(panel.webview, scriptUri, getNonce())
    panel.title = DesignerPanel.titleFor(uri)

    panel.webview.onDidReceiveMessage(
      (m: InboundMessage) => void this.onMessage(m),
      undefined,
      this.disposables,
    )
    // Canvas ↔ source synchronization (task 8.4): every debounced
    // re-synthesis for our document — designer write or external text edit
    // alike — re-pulls the model; the webview diffs by node id.
    this.disposables.push(
      this.client.onSynthesized(({ uri }) => {
        if (uri === this.uri) void this.refresh()
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`Designer opened for ${basename(uri)}`)
    void this.panel.webview.postMessage({
      type: "static",
      data: buildStaticData(),
    })
    void this.refresh()
  }

  /** Point the panel at a different pipeline and re-render. */
  retarget(uri: string): void {
    if (uri === this.uri) {
      void this.refresh()
      return
    }
    this.uri = uri
    this.renderedVersion = -1
    this.panel.title = DesignerPanel.titleFor(uri)
    getOutputChannel().info(`Designer retargeted to ${basename(uri)}`)
    void this.refresh()
  }

  /** Pull the designer model and post it (stale responses dropped). */
  async refresh(): Promise<void> {
    const model = await this.client.sendGraphRequest<DesignerModelResponse>(
      DESIGNER_MODEL_REQUEST,
      { uri: this.uri, version: this.renderedVersion },
    )
    if (!model) return
    if (model.ok && model.version < this.renderedVersion) return
    if (model.ok) this.renderedVersion = model.version
    this.lastModel = model
    getOutputChannel().info(
      `Designer model refreshed (${basename(this.uri)} v${model.version}, ok=${model.ok}, ${model.nodes.length} nodes, ${model.fileKind})`,
    )
    void this.panel.webview.postMessage({ type: "model", model })
  }

  private async onMessage(message: InboundMessage): Promise<void> {
    switch (message.type) {
      case "requestRefresh":
        return this.refresh()
      case "rendered":
        this.lastRender = {
          ok: message.ok,
          version: message.version,
          nodeCount: message.nodeCount,
        }
        return
      case "revealNode":
        return this.revealNode(message.nodeId)
      case "applyEdit":
        await this.applyEdit(message.edit)
        return
      case "generateDraft":
        return this.generateDraft(message.nodes)
    }
  }

  /**
   * Broker one edit intent to `flinkReactor/applyDesignerEdit` and apply the
   * committed change as a `WorkspaceEdit` (visible and undoable). Refusals
   * and rollbacks arrive as data and surface in the webview status strip +
   * the output channel — the designer never writes around a refusal. Public
   * for the e2e suite (the sandboxed webview cannot be driven from the host).
   */
  async applyEdit(edit: DesignerEdit): Promise<DesignerEditOutcome> {
    const response =
      await this.client.sendGraphRequest<ApplyDesignerEditResponse>(
        APPLY_DESIGNER_EDIT_REQUEST,
        { uri: this.uri, version: this.renderedVersion, edit },
      )
    let outcome: DesignerEditOutcome
    if (!response) {
      outcome = { ok: false, error: "Language server unavailable." }
    } else if (response.ok && response.newFileContent !== undefined) {
      // A `generate` edit: the server printed + verified a NEW file; creating
      // it on disk is the `generateDraft` flow's job (it owns the dialogs).
      outcome = { ok: true, newFileContent: response.newFileContent }
    } else if (response.ok && response.edits) {
      const workspaceEdit = new vscode.WorkspaceEdit()
      for (const e of response.edits) {
        workspaceEdit.replace(
          vscode.Uri.parse(this.uri),
          new vscode.Range(
            e.range.start.line,
            e.range.start.character,
            e.range.end.line,
            e.range.end.character,
          ),
          e.newText,
        )
      }
      const applied = await vscode.workspace.applyEdit(workspaceEdit)
      outcome = applied
        ? { ok: true }
        : { ok: false, error: "VS Code rejected the workspace edit." }
      // No optimistic state: the didChange → re-synthesis → synthesized
      // notification path re-renders the canvas from the new model.
    } else {
      outcome = {
        ok: false,
        ...(response.refusedReason
          ? { refusedReason: response.refusedReason }
          : {}),
        ...(response.error ? { error: response.error } : {}),
      }
    }
    this.lastEdit = outcome
    const detail = outcome.ok
      ? "applied"
      : (outcome.refusedReason ?? outcome.error ?? "failed")
    getOutputChannel().info(
      `Designer edit ${editLabel(edit)} → ${outcome.ok ? "applied" : `refused: ${detail}`} (${basename(this.uri)})`,
    )
    void this.panel.webview.postMessage({ type: "editResult", ...outcome })
    return outcome
  }

  /** Greenfield generation: name + location are picked host-side, the server
   *  prints + verifies the file, and the extension creates it on disk. */
  private async generateDraft(nodes: readonly CanvasNode[]): Promise<void> {
    const pipelineName = await vscode.window.showInputBox({
      prompt: "Pipeline name for the generated .tsx",
      value: "my-pipeline",
      validateInput: (v) =>
        /^[a-z0-9][a-z0-9-]*$/.test(v)
          ? undefined
          : "Use lowercase letters, digits, and dashes.",
    })
    if (!pipelineName) return
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri
    const target = await vscode.window.showSaveDialog({
      ...(folder
        ? {
            defaultUri: vscode.Uri.joinPath(
              folder,
              "pipelines",
              pipelineName,
              "index.tsx",
            ),
          }
        : {}),
      filters: { "TSX pipeline": ["tsx"] },
      title: "Generate pipeline file",
    })
    if (!target) return

    const response =
      await this.client.sendGraphRequest<ApplyDesignerEditResponse>(
        APPLY_DESIGNER_EDIT_REQUEST,
        {
          uri: this.uri,
          edit: { kind: "generate", pipelineName, nodes },
        },
      )
    if (!response?.ok || response.newFileContent === undefined) {
      const reason =
        response?.refusedReason ?? response?.error ?? "generation failed"
      this.lastEdit = { ok: false, error: reason }
      getOutputChannel().warn(`Designer generate refused: ${reason}`)
      void this.panel.webview.postMessage({
        type: "editResult",
        ok: false,
        error: reason,
      })
      return
    }
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.createFile(target, {
      contents: Buffer.from(response.newFileContent, "utf8"),
      overwrite: false,
    })
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    this.lastEdit = applied
      ? { ok: true }
      : { ok: false, error: "Could not create the file." }
    getOutputChannel().info(
      `Designer generated ${target.fsPath} (${nodes.length} top-level node(s))`,
    )
    void this.panel.webview.postMessage({
      type: "editResult",
      ok: applied,
    })
    if (applied) {
      const doc = await vscode.workspace.openTextDocument(target)
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
      })
    }
  }

  /** Resolve a node's source range and reveal + select it in the `.tsx` —
   *  the click-to-source path and the "Edit in source" affordance. Public for
   *  the e2e suite. */
  async revealNode(nodeId: string): Promise<void> {
    const result = await this.client.sendGraphRequest<NodeRangeResult>(
      NODE_RANGE_REQUEST,
      { uri: this.uri, nodeId },
    )
    const range = result?.range
    if (!range) {
      vscode.window.setStatusBarMessage(
        `FlinkReactor: no source location for node "${nodeId}".`,
        4000,
      )
      return
    }
    const selection = new vscode.Range(
      range.start.line,
      range.start.character,
      range.end.line,
      range.end.character,
    )
    try {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(this.uri),
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
    } catch (err) {
      getOutputChannel().warn(`Could not reveal node ${nodeId}: ${String(err)}`)
    }
  }

  private static titleFor(uri: string): string {
    try {
      return `Designer — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "Pipeline Designer"
    }
  }

  private dispose(): void {
    DesignerPanel.instance = undefined
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}

// ── Static designer data (host-resolved; the webview consumes JSON) ──

/** Kind → palette heading. Every top-level inventory component lands under
 *  exactly one group (escape hatches collect RawSQL/UDF/CEP; containers
 *  collect Pipeline/View/MaterializedTable/Qualify). */
const KIND_GROUPS: readonly { heading: string; kinds: readonly string[] }[] = [
  { heading: "Sources", kinds: ["Source"] },
  { heading: "Sinks", kinds: ["Sink"] },
  { heading: "Transforms", kinds: ["Transform"] },
  { heading: "Joins", kinds: ["Join"] },
  { heading: "Windows", kinds: ["Window"] },
  { heading: "Catalogs", kinds: ["Catalog"] },
  { heading: "Escape hatches", kinds: ["RawSQL", "UDF", "CEP"] },
  {
    heading: "Containers",
    kinds: ["Pipeline", "View", "MaterializedTable", "Qualify"],
  },
]

function buildStaticData(): DesignerStaticData {
  const byKind = new Map<string, string[]>()
  for (const [component, kind] of DSL_COMPONENTS) {
    const list = byKind.get(kind) ?? []
    list.push(component)
    byKind.set(kind, list)
  }
  const groups: PaletteGroup[] = []
  for (const { heading, kinds } of KIND_GROUPS) {
    const components = kinds
      .flatMap((k) => byKind.get(k) ?? [])
      .sort((a, b) => a.localeCompare(b))
    if (components.length > 0) groups.push({ kind: heading, components })
  }
  return {
    groups,
    rules: COMPONENT_CHILDREN,
    schema: PROP_FORM_SCHEMA,
  }
}

function editLabel(edit: DesignerEdit): string {
  if (edit.kind === "scalarProp") return `${edit.nodeId}.${edit.prop}`
  if (edit.kind === "structural") return edit.edit.op
  return "generate"
}
