import { basename } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import {
  TAP_MANIFEST_REQUEST,
  type TapManifestResponse,
} from "../taps/protocol.js"
import { getOutputChannel } from "../ui/output.js"
import { buildHtml, getNonce } from "./html.js"
import {
  GRAPH_MODEL_REQUEST,
  type GraphModelResponse,
  NODE_RANGE_REQUEST,
  type NodeRangeResult,
} from "./protocol.js"

/** Messages the webview posts back to the extension host. */
type InboundMessage =
  | { readonly type: "nodeClicked"; readonly nodeId: string }
  | { readonly type: "requestRefresh" }
  | {
      readonly type: "rendered"
      readonly ok: boolean
      readonly version: number
      readonly nodeCount: number
    }
  | { readonly type: "tapOverlayApplied"; readonly markedCount: number }

/** What the webview last drew — exposed for the e2e suite (the sandboxed
 *  webview DOM is otherwise unreadable from the host). */
export interface RenderInfo {
  readonly ok: boolean
  readonly version: number
  readonly nodeCount: number
}

/** The overlay's last application ack (e2e visibility). */
export interface TapOverlayInfo {
  readonly active: boolean
  readonly markedCount: number
}

/**
 * The singleton "Pipeline DAG" webview panel. Owns one webview beside the
 * editor, brokers all LSP traffic (the webview never holds the client), pulls
 * the graph model on demand + on each debounced re-synthesis, and navigates
 * from a clicked node to its originating JSX.
 */
export class GraphPanel {
  public static readonly viewType = "flinkReactor.graph"
  private static instance: GraphPanel | undefined

  private readonly disposables: vscode.Disposable[] = []
  /** Highest document version posted to the webview — newer pulls win, stale
   *  in-flight responses are dropped (the envelope carries the version). */
  private renderedVersion = -1
  /** The webview's last render acknowledgement (for the e2e suite). */
  private lastRender: RenderInfo | undefined
  /** Tap-overlay toggle state (tap-visualization, Tier-3 feature 13). When
   *  on, each refresh re-pulls the tap manifest and re-posts the overlay so
   *  badges track the re-rendered graph. */
  private tapOverlayActive = false
  /** The webview's last overlay application ack (e2e visibility). */
  private lastTapOverlay: TapOverlayInfo = { active: false, markedCount: 0 }

  /**
   * Reveal the panel for `uri`, creating it (beside the active editor) on first
   * use and retargeting the existing one otherwise — re-invoking the command
   * never opens a second panel.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    if (GraphPanel.instance) {
      GraphPanel.instance.retarget(uri)
      GraphPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      GraphPanel.viewType,
      "Pipeline DAG",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    )
    GraphPanel.instance = new GraphPanel(panel, extensionUri, client, uri)
  }

  /** Test/refresh hook: the live panel, if any. */
  static get active(): GraphPanel | undefined {
    return GraphPanel.instance
  }

  /** The webview's most recent render acknowledgement (e2e visibility). */
  get render(): RenderInfo | undefined {
    return this.lastRender
  }

  /** The overlay's toggle state + last application ack (e2e visibility). */
  get tapOverlay(): TapOverlayInfo {
    return { ...this.lastTapOverlay, active: this.tapOverlayActive }
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly client: FlinkReactorClient,
    private uri: string,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "graph.js"),
    )
    panel.webview.html = buildHtml(panel.webview, scriptUri, getNonce())
    panel.title = GraphPanel.titleFor(uri)

    panel.webview.onDidReceiveMessage(
      (m: InboundMessage) => this.onMessage(m),
      undefined,
      this.disposables,
    )
    // Live refresh: re-pull on the server's debounced re-synthesis for our doc.
    this.disposables.push(
      client.onSynthesized(({ uri }) => {
        if (uri === this.uri) void this.refresh()
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`DAG panel opened for ${basename(uri)}`)
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
    this.panel.title = GraphPanel.titleFor(uri)
    getOutputChannel().info(`DAG panel retargeted to ${basename(uri)}`)
    void this.refresh()
  }

  /** Pull the model for the current document and post it to the webview. */
  async refresh(): Promise<void> {
    const model = await this.client.sendGraphRequest<GraphModelResponse>(
      GRAPH_MODEL_REQUEST,
      { uri: this.uri, version: this.renderedVersion },
    )
    if (!model) return
    // Drop a successful response older than what we already rendered (a slower
    // request that lost the race). An error envelope is always forwarded so the
    // webview can surface it over the last good graph.
    if (model.ok && model.version < this.renderedVersion) return
    if (model.ok) this.renderedVersion = model.version
    getOutputChannel().info(
      `DAG model refreshed (${basename(this.uri)} v${model.version}, ok=${model.ok}, ${model.nodes.length} nodes)`,
    )
    void this.panel.webview.postMessage({ type: "model", model })
    // Keep the tap overlay aligned with the re-rendered graph: both views
    // re-read the same synthesis version, so badges reconcile by node id.
    if (this.tapOverlayActive) void this.postTapOverlay()
  }

  /**
   * Toggle the tap-visualization overlay (tap badges on tapped nodes). On
   * enable, the tap manifest is pulled and posted into the webview as an
   * additive `tapOverlay` message; on disable, a clear is posted — the
   * underlying graph is never re-laid-out. Returns the new state.
   */
  async toggleTapOverlay(): Promise<boolean> {
    this.tapOverlayActive = !this.tapOverlayActive
    if (this.tapOverlayActive) {
      await this.postTapOverlay()
    } else {
      void this.panel.webview.postMessage({ type: "tapOverlay", nodeIds: null })
      getOutputChannel().info(`Tap overlay cleared (${basename(this.uri)})`)
    }
    return this.tapOverlayActive
  }

  /** Pull the tap manifest and post the overlay's tapped node ids. */
  private async postTapOverlay(): Promise<void> {
    const manifest = await this.client.sendGraphRequest<TapManifestResponse>(
      TAP_MANIFEST_REQUEST,
      { uri: this.uri },
    )
    // A failed pull/synthesis adds no badges; the next good refresh reconciles.
    const nodeIds = manifest?.ok ? manifest.taps.map((t) => t.nodeId) : []
    void this.panel.webview.postMessage({ type: "tapOverlay", nodeIds })
    getOutputChannel().info(
      `Tap overlay posted (${basename(this.uri)}, ${nodeIds.length} tapped node(s))`,
    )
  }

  private onMessage(message: InboundMessage): void {
    if (message.type === "requestRefresh") {
      void this.refresh()
      return
    }
    if (message.type === "rendered") {
      this.lastRender = {
        ok: message.ok,
        version: message.version,
        nodeCount: message.nodeCount,
      }
      return
    }
    if (message.type === "tapOverlayApplied") {
      this.lastTapOverlay = {
        active: this.tapOverlayActive,
        markedCount: message.markedCount,
      }
      return
    }
    if (message.type === "nodeClicked") {
      void this.revealNode(message.nodeId)
    }
  }

  /** Resolve a node's source range and reveal + select it in the .tsx. Public
   *  so the e2e suite can exercise the navigation path the webview click drives
   *  (the sandboxed webview cannot be clicked from the host). */
  async revealNode(nodeId: string): Promise<void> {
    const result = await this.client.sendGraphRequest<NodeRangeResult>(
      NODE_RANGE_REQUEST,
      { uri: this.uri, nodeId },
    )
    const range = result?.range
    if (!range) {
      // 5.2 — non-blocking notice; leave the editor selection untouched.
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
      return `DAG — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "Pipeline DAG"
    }
  }

  private dispose(): void {
    GraphPanel.instance = undefined
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}
