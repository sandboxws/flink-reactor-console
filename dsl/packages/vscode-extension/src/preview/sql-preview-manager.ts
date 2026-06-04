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

/** Auto = re-pull on every server re-synthesis; manual = only on an explicit
 *  Refresh (the webview shows a "pending" hint when the pipeline has moved on). */
type SyncMode = "auto" | "manual"

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
  | {
      readonly type: "sync"
      readonly mode: SyncMode
      readonly pending: boolean
    }

/** Messages the webview posts back to the host. */
type InboundMessage =
  | { readonly type: "ready" }
  | { readonly type: "requestRefresh" }
  | { readonly type: "setSyncMode"; readonly mode: SyncMode }
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
 * A read-only SQL Preview webview that **follows the active pipeline** — a single
 * panel beside the editor, re-targeted to whichever pipeline `.tsx` is focused
 * (like the DAG + CRD panels; switching pipelines auto-updates this tab). The
 * panel brokers all LSP traffic: pulls the synthesized SQL on open / retarget /
 * each debounced re-synthesis, pushes the active node id as the editor caret
 * moves (DSL→SQL), and reveals the `.tsx` range when the webview reports a
 * clicked SQL span (SQL→DSL). On synthesis failure it keeps the last good SQL and
 * tells the webview to show a stale banner.
 */
export class SqlPreviewPanel {
  public static readonly viewType = "flinkReactor.sqlPreview"
  /** Single live preview, re-targeted to follow the active pipeline editor
   *  (mirrors `CrdPreviewPanel`). `undefined` when no preview is open. */
  private static instance: SqlPreviewPanel | undefined

  private readonly disposables: vscode.Disposable[] = []
  /** Highest model version posted to the webview — a slower in-flight response
   *  older than this is dropped. `-1` until the first successful render. */
  private renderedVersion = -1
  /** The last synthesis failure summary, surfaced on demand from the banner. */
  private lastError: string | undefined
  private lastRender: SqlRenderInfo | undefined
  private lastHighlightInfo: SqlHighlightInfo | undefined
  /** Auto (default) re-pulls on every re-synthesis; manual freezes the view
   *  until the user clicks Refresh. */
  private syncMode: SyncMode = "auto"
  /** Manual mode only: the pipeline re-synthesized since the last pull, so the
   *  shown SQL is behind the source. */
  private pendingResynth = false

  /**
   * Reveal the preview for `uri`, creating it beside the editor on first use and
   * re-targeting the existing one otherwise — re-invoking never opens a duplicate.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    if (SqlPreviewPanel.instance) {
      SqlPreviewPanel.instance.retarget(uri)
      SqlPreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
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
    SqlPreviewPanel.instance = new SqlPreviewPanel(
      panel,
      extensionUri,
      client,
      uri,
    )
  }

  /** Re-target the open panel when the active editor switches to a different
   *  FlinkReactor pipeline. No-op when no panel is open. */
  static handleActiveEditor(uri: string): void {
    SqlPreviewPanel.instance?.retarget(uri)
  }

  /** Route an editor caret/selection change to the panel (DSL→SQL), but only
   *  when it is currently bound to that document. No-op otherwise. */
  static async handleSelection(editor: vscode.TextEditor): Promise<void> {
    const inst = SqlPreviewPanel.instance
    if (inst && inst.uri === editor.document.uri.toString())
      await inst.onEditorSelection(editor)
  }

  /** The live panel iff it is currently bound to `uri` (e2e visibility — keeps
   *  the URI-addressed API meaning "the preview showing this pipeline"). */
  static forUri(uri: string): SqlPreviewPanel | undefined {
    const inst = SqlPreviewPanel.instance
    return inst && inst.uri === uri ? inst : undefined
  }

  /** Number of open preview panels (e2e: assert no duplicates). */
  static get count(): number {
    return SqlPreviewPanel.instance ? 1 : 0
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
    private uri: string,
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
        if (uri !== this.uri) return
        if (this.syncMode === "auto") {
          void this.refresh()
        } else {
          // Manual: don't pull; flag that the source moved on so the webview
          // can show a "changed — Refresh" hint over the frozen SQL.
          this.pendingResynth = true
          this.postSyncState()
        }
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`SQL preview opened for ${basename(uri)}`)
    void this.refresh()
  }

  /** Point the panel at a different pipeline and re-render. Re-targeting to the
   *  same uri just refreshes. The user's sync-mode preference persists across a
   *  retarget; the version/error/highlight state resets for the new document. */
  retarget(uri: string): void {
    if (uri === this.uri) {
      void this.refresh()
      return
    }
    this.uri = uri
    this.renderedVersion = -1
    this.lastError = undefined
    this.lastRender = undefined
    this.lastHighlightInfo = undefined
    this.pendingResynth = false
    this.panel.title = SqlPreviewPanel.titleFor(uri)
    getOutputChannel().info(`SQL preview retargeted to ${basename(uri)}`)
    void this.refresh()
    this.postSyncState()
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
        void this.refresh()
        // Tell the freshly-loaded webview the current sync state.
        this.postSyncState()
        return
      case "requestRefresh":
        this.pendingResynth = false
        void this.refresh()
        this.postSyncState()
        return
      case "setSyncMode":
        this.syncMode = message.mode
        this.pendingResynth = false
        // Switching back to auto catches up on whatever changed while paused.
        if (this.syncMode === "auto") void this.refresh()
        this.postSyncState()
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

  /** Push the current sync mode + pending flag so the webview's toolbar reflects
   *  it (auto/manual label + the "changed — Refresh" hint). */
  private postSyncState(): void {
    this.post({
      type: "sync",
      mode: this.syncMode,
      pending: this.pendingResynth,
    })
  }

  private static titleFor(uri: string): string {
    try {
      return `SQL — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "SQL Preview"
    }
  }

  private dispose(): void {
    if (SqlPreviewPanel.instance === this) SqlPreviewPanel.instance = undefined
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}
