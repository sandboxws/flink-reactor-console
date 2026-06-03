import { basename } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import { getOutputChannel } from "../ui/output.js"
import { buildHtml, getNonce } from "./html.js"
import {
  NODE_AT_POSITION_REQUEST,
  NODE_RANGE_REQUEST,
  type NodeAtPositionResult,
  type NodeRangeResult,
  SYNTH_REQUEST,
  type SynthPipeline,
  type SynthResponse,
} from "./protocol.js"

/** Messages the extension host posts to the webview. */
type OutboundMessage =
  | {
      readonly type: "synth"
      readonly version: number
      readonly pipeline: SynthPipeline
    }
  | {
      readonly type: "failure"
      readonly version: number
      readonly error: string
    }
  | {
      readonly type: "activeNode"
      readonly nodeId: string | null
      readonly version: number
    }

/** Messages the webview posts back to the host. */
type InboundMessage =
  | { readonly type: "ready" }
  | { readonly type: "requestRefresh" }
  | { readonly type: "revealNode"; readonly nodeId: string }
  | { readonly type: "showFailure" }
  | {
      readonly type: "rendered"
      readonly ok: boolean
      readonly version: number
      readonly blockCount: number
      readonly statementCount: number
    }
  | {
      readonly type: "highlighted"
      readonly nodeId: string | null
      readonly wholeCount: number
      readonly spanCount: number
    }

/** What the webview last drew — exposed for the e2e suite (the sandboxed webview
 *  DOM is otherwise unreadable from the host). */
export interface SqlRenderInfo {
  readonly ok: boolean
  readonly version: number
  readonly blockCount: number
  readonly statementCount: number
}

/** The webview's last DSL→SQL highlight acknowledgement — the active node id
 *  plus how many whole statements / sub-statement spans lit up (e2e visibility
 *  into a path that otherwise lives entirely inside the sandboxed webview). */
export interface SqlHighlightInfo {
  readonly nodeId: string | null
  readonly wholeCount: number
  readonly spanCount: number
}

/** A short-lived editor decoration that flashes a revealed range, then clears. */
const FLASH = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
  isWholeLine: false,
})

/**
 * A read-only SQL Preview webview bound to one `.tsx` pipeline document. Unlike
 * the singleton DAG panel, there is **one panel per document URI** (re-invoking
 * the command reveals the existing one). The panel brokers all LSP traffic:
 * pulls the synthesized SQL on open + on each debounced re-synthesis, pushes the
 * active node id as the editor caret moves (DSL→SQL), and reveals the `.tsx`
 * range when the webview reports a clicked SQL span (SQL→DSL). On synthesis
 * failure it keeps the last good SQL and tells the webview to show a stale
 * banner.
 */
export class SqlPreviewPanel {
  public static readonly viewType = "flinkReactor.sqlPreview"
  private static readonly panels = new Map<string, SqlPreviewPanel>()

  private readonly disposables: vscode.Disposable[] = []
  /** Highest model version posted to the webview — a slower in-flight response
   *  older than this is dropped. `-1` until the first successful render. */
  private renderedVersion = -1
  /** The last synthesis failure summary, surfaced on demand from the banner. */
  private lastError: string | undefined
  private lastRender: SqlRenderInfo | undefined
  private lastHighlightInfo: SqlHighlightInfo | undefined

  /**
   * Reveal the preview for `uri`, creating it beside the editor on first use and
   * revealing the existing one otherwise — re-invoking never opens a duplicate.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    const existing = SqlPreviewPanel.panels.get(uri)
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside, true)
      void existing.refresh()
      return
    }
    const panel = vscode.window.createWebviewPanel(
      SqlPreviewPanel.viewType,
      SqlPreviewPanel.titleFor(uri),
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    )
    SqlPreviewPanel.panels.set(
      uri,
      new SqlPreviewPanel(panel, extensionUri, client, uri),
    )
  }

  /** Route an editor caret/selection change to the panel bound to that document
   *  (DSL→SQL). No-op when no preview is open for the document. */
  static async handleSelection(editor: vscode.TextEditor): Promise<void> {
    const panel = SqlPreviewPanel.panels.get(editor.document.uri.toString())
    if (panel) await panel.onEditorSelection(editor)
  }

  /** Dispose the panel bound to a closed document (2.3). */
  static handleDocumentClose(uri: string): void {
    SqlPreviewPanel.panels.get(uri)?.dispose()
  }

  /** The live panel for `uri`, if any (e2e visibility). */
  static forUri(uri: string): SqlPreviewPanel | undefined {
    return SqlPreviewPanel.panels.get(uri)
  }

  /** Number of open preview panels (e2e: assert no duplicates). */
  static get count(): number {
    return SqlPreviewPanel.panels.size
  }

  get render(): SqlRenderInfo | undefined {
    return this.lastRender
  }

  get lastHighlight(): SqlHighlightInfo | undefined {
    return this.lastHighlightInfo
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly client: FlinkReactorClient,
    private readonly uri: string,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "sql-preview.js"),
    )
    panel.webview.html = buildHtml(panel.webview, scriptUri, getNonce())

    panel.webview.onDidReceiveMessage(
      (m: InboundMessage) => this.onMessage(m),
      undefined,
      this.disposables,
    )
    // Live refresh: re-pull on the server's debounced re-synthesis for our doc
    // (the same `flinkReactor/synthesized` signal the DAG panel uses — no second
    // client-side debounce).
    this.disposables.push(
      client.onSynthesized(({ uri }) => {
        if (uri === this.uri) void this.refresh()
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`SQL preview opened for ${basename(uri)}`)
    void this.refresh()
  }

  /** Pull the synth model and post it (or a failure) to the webview. Pure
   *  projection server-side — never triggers a re-synthesis. */
  async refresh(): Promise<void> {
    const model = await this.client.sendGraphRequest<SynthResponse>(
      SYNTH_REQUEST,
      { uri: this.uri, version: this.renderedVersion },
    )
    if (!model) return

    if (model.ok && model.pipelines.length > 0) {
      // Drop a successful response older than what we already rendered.
      if (model.version < this.renderedVersion) return
      this.renderedVersion = model.version
      this.lastError = undefined
      this.post({
        type: "synth",
        version: model.version,
        pipeline: model.pipelines[0],
      })
      return
    }

    // Synthesis failing (or nothing cached yet): keep the last good SQL in the
    // webview and surface a stale banner. The webview shows the error state
    // only when it has no prior good render.
    this.lastError = model.error ?? "synthesis is failing"
    getOutputChannel().warn(
      `SQL preview: synthesis failing for ${basename(this.uri)} — ${this.lastError}`,
    )
    this.post({
      type: "failure",
      version: model.version,
      error: this.lastError,
    })
  }

  /** DSL→SQL: resolve the caret to a node id and push it to the webview. */
  private async onEditorSelection(editor: vscode.TextEditor): Promise<void> {
    const pos = editor.selection.active
    const res = await this.client.sendGraphRequest<NodeAtPositionResult>(
      NODE_AT_POSITION_REQUEST,
      {
        uri: this.uri,
        position: { line: pos.line, character: pos.character },
      },
    )
    this.post({
      type: "activeNode",
      nodeId: res?.nodeId ?? null,
      version: editor.document.version,
    })
  }

  private onMessage(message: InboundMessage): void {
    switch (message.type) {
      case "ready":
      case "requestRefresh":
        void this.refresh()
        return
      case "revealNode":
        void this.revealNode(message.nodeId)
        return
      case "showFailure":
        if (this.lastError) {
          void vscode.window.showWarningMessage(
            `FlinkReactor SQL preview is stale — synthesis is failing:\n${this.lastError}`,
          )
        }
        return
      case "rendered":
        this.lastRender = {
          ok: message.ok,
          version: message.version,
          blockCount: message.blockCount,
          statementCount: message.statementCount,
        }
        return
      case "highlighted":
        this.lastHighlightInfo = {
          nodeId: message.nodeId,
          wholeCount: message.wholeCount,
          spanCount: message.spanCount,
        }
        return
    }
  }

  /**
   * SQL→DSL: resolve the node's source range and reveal + select it in the
   * `.tsx`, with a brief flash. Public so the e2e suite can exercise the click
   * path (the sandboxed webview cannot be clicked from the host).
   */
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
      // Brief flash on arrival, then clear.
      editor.setDecorations(FLASH, [selection])
      setTimeout(() => editor.setDecorations(FLASH, []), 900)
    } catch (err) {
      getOutputChannel().warn(`Could not reveal node ${nodeId}: ${String(err)}`)
    }
  }

  private post(message: OutboundMessage): void {
    void this.panel.webview.postMessage(message)
  }

  private static titleFor(uri: string): string {
    try {
      return `SQL — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "SQL Preview"
    }
  }

  private dispose(): void {
    SqlPreviewPanel.panels.delete(this.uri)
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}
