// The singleton "Pipeline Taps" webview panel (tap-visualization, Tier-3
// feature 13). Owns one webview beside the editor, brokers all LSP traffic
// (the webview never holds the client), pulls the tap manifest on demand + on
// each debounced re-synthesis, and navigates from a clicked tap to its
// originating JSX — the same node identity (`ConstructNode.id`) and
// navigation path the DAG panel uses.

import { basename } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import { NODE_RANGE_REQUEST, type NodeRangeResult } from "../graph/protocol.js"
import { getOutputChannel } from "../ui/output.js"
import { buildTapHtml, getNonce } from "./html.js"
import { TAP_MANIFEST_REQUEST, type TapManifestResponse } from "./protocol.js"

/** Messages the webview posts back to the extension host. */
type InboundMessage =
  | { readonly type: "tapClicked"; readonly nodeId: string }
  | { readonly type: "requestRefresh" }
  | {
      readonly type: "rendered"
      readonly ok: boolean
      readonly version: number
      readonly tapCount: number
      readonly autoTapCount: number
    }

/** What the webview last drew — exposed for the e2e suite (the sandboxed
 *  webview DOM is otherwise unreadable from the host). */
export interface TapRenderInfo {
  readonly ok: boolean
  readonly version: number
  readonly tapCount: number
  readonly autoTapCount: number
}

export class TapsPanel {
  public static readonly viewType = "flinkReactor.taps"
  private static instance: TapsPanel | undefined

  private readonly disposables: vscode.Disposable[] = []
  /** Highest document version posted to the webview — newer pulls win, stale
   *  in-flight responses are dropped (the envelope carries the version). */
  private renderedVersion = -1
  /** The webview's last render acknowledgement (for the e2e suite). */
  private lastRender: TapRenderInfo | undefined
  /** The last manifest the host pulled (for the e2e suite — strategy/schema/
   *  SQL assertions live on the data the webview rendered). */
  private lastManifestEnvelope: TapManifestResponse | undefined

  /**
   * Reveal the panel for `uri`, creating it (beside the active editor) on
   * first use and retargeting the existing one otherwise — re-invoking the
   * command never opens a second panel.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    if (TapsPanel.instance) {
      TapsPanel.instance.retarget(uri)
      TapsPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      TapsPanel.viewType,
      "Pipeline Taps",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    )
    TapsPanel.instance = new TapsPanel(panel, extensionUri, client, uri)
  }

  /** Test/refresh hook: the live panel, if any. */
  static get active(): TapsPanel | undefined {
    return TapsPanel.instance
  }

  /** The webview's most recent render acknowledgement (e2e visibility). */
  get render(): TapRenderInfo | undefined {
    return this.lastRender
  }

  /** The last tap manifest pulled for the panel (e2e visibility). */
  get manifest(): TapManifestResponse | undefined {
    return this.lastManifestEnvelope
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly client: FlinkReactorClient,
    private uri: string,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "taps.js"),
    )
    panel.webview.html = buildTapHtml(panel.webview, scriptUri, getNonce())
    panel.title = TapsPanel.titleFor(uri)

    panel.webview.onDidReceiveMessage(
      (m: InboundMessage) => this.onMessage(m),
      undefined,
      this.disposables,
    )
    // Live refresh: re-pull on the server's debounced re-synthesis for our doc.
    this.disposables.push(
      this.client.onSynthesized(({ uri }) => {
        if (uri === this.uri) void this.refresh()
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`Tap panel opened for ${basename(uri)}`)
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
    this.panel.title = TapsPanel.titleFor(uri)
    getOutputChannel().info(`Tap panel retargeted to ${basename(uri)}`)
    void this.refresh()
  }

  /** Pull the manifest for the current document and post it to the webview. */
  async refresh(): Promise<void> {
    const manifest = await this.client.sendGraphRequest<TapManifestResponse>(
      TAP_MANIFEST_REQUEST,
      { uri: this.uri, version: this.renderedVersion },
    )
    if (!manifest) return
    // Drop a successful response older than what we already rendered (a
    // slower request that lost the race). An error envelope is always
    // forwarded so the webview can dim the last good taps under it.
    if (manifest.ok && manifest.version < this.renderedVersion) return
    if (manifest.ok) {
      this.renderedVersion = manifest.version
      this.lastManifestEnvelope = manifest
    }
    getOutputChannel().info(
      `Tap manifest refreshed (${basename(this.uri)} v${manifest.version}, ok=${manifest.ok}, ${manifest.taps.length} taps)`,
    )
    void this.panel.webview.postMessage({ type: "manifest", manifest })
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
        tapCount: message.tapCount,
        autoTapCount: message.autoTapCount,
      }
      return
    }
    if (message.type === "tapClicked") {
      void this.revealTap(message.nodeId)
    }
  }

  /** Resolve a tapped node's source range and reveal + select its JSX —
   *  the same navigation path the DAG panel uses (`flinkReactor/nodeRange`).
   *  Public so the e2e suite can exercise it (the sandboxed webview cannot be
   *  clicked from the host). */
  async revealTap(nodeId: string): Promise<void> {
    const result = await this.client.sendGraphRequest<NodeRangeResult>(
      NODE_RANGE_REQUEST,
      { uri: this.uri, nodeId },
    )
    const range = result?.range
    if (!range) {
      // 6.2 — non-blocking notice; leave the editor selection untouched.
      vscode.window.setStatusBarMessage(
        `FlinkReactor: no source location for tap "${nodeId}".`,
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
      getOutputChannel().warn(`Could not reveal tap ${nodeId}: ${String(err)}`)
    }
  }

  private static titleFor(uri: string): string {
    try {
      return `Taps — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "Pipeline Taps"
    }
  }

  private dispose(): void {
    TapsPanel.instance = undefined
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}
