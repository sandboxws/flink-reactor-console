import { basename, dirname, join } from "node:path"
import * as vscode from "vscode"
import type { FlinkReactorClient } from "../client/launch.js"
import { getOutputChannel } from "../ui/output.js"
import { resolveProjectContext } from "../workspace/project-context.js"
import { buildCrdHtml, getNonce } from "./crd-html.js"
import {
  CRD_PREVIEW_REQUEST,
  type CrdArtifact,
  type CrdPreviewPipeline,
  type CrdPreviewResponse,
  type PipelineKind,
} from "./crd-protocol.js"

/** Messages the extension host posts to the webview. */
type OutboundMessage =
  | {
      readonly type: "render"
      readonly version: number
      readonly stale: boolean
      readonly pipeline: CrdPreviewPipeline
      readonly error?: string
    }
  | { readonly type: "error"; readonly error: string }
  | { readonly type: "empty" }
  | { readonly type: "selectTab"; readonly index: number }

/** Messages the webview posts back to the host. */
type InboundMessage =
  | { readonly type: "ready" }
  | { readonly type: "requestRefresh" }
  | { readonly type: "showError" }
  | { readonly type: "copy"; readonly artifactId: string }
  | { readonly type: "save"; readonly artifactId: string }
  | { readonly type: "saveAll" }
  | {
      readonly type: "rendered"
      readonly ok: boolean
      readonly version: number
      readonly pipelineName: string
      readonly pipelineKind: PipelineKind
      readonly tabCount: number
      readonly activeTab: number
      readonly activeFilename: string
    }

/** A lightweight `CrdArtifact` view (no YAML) for the e2e suite to assert the
 *  tab set without shipping every artifact body across the API. */
export interface CrdArtifactInfo {
  readonly id: string
  readonly label: string
  readonly filename: string
  readonly kind: string
}

/** What the webview last drew — exposed for the e2e suite (the sandboxed
 *  webview DOM is otherwise unreadable from the host). */
export interface CrdRenderInfo {
  readonly ok: boolean
  readonly version: number
  readonly pipelineName: string
  readonly pipelineKind: PipelineKind
  readonly tabCount: number
  readonly activeTab: number
  readonly activeFilename: string
  /** Whether a stale banner is showing over a last-good set. */
  readonly stale: boolean
}

/**
 * The singleton "CRD Preview" webview panel (crd-preview, Tier-2 feature 6).
 * Owns one webview beside the editor, re-targeted to the active pipeline, and
 * brokers all LSP traffic (the webview never holds the client): pulls the
 * artifact set on open + on each debounced re-synthesis, caches the last-good
 * set per URI for the stale fallback, and writes artifacts to `dist/<pipeline>/`
 * on the webview's copy/save requests.
 */
export class CrdPreviewPanel {
  public static readonly viewType = "flinkReactor.crdPreview"
  private static instance: CrdPreviewPanel | undefined

  private readonly disposables: vscode.Disposable[] = []
  /** Highest version posted to the webview — a slower in-flight ok-response
   *  older than this is dropped. `-1` until the first successful render. */
  private renderedVersion = -1
  /** Last successful artifact set per URI — the stale-banner fallback (6.1). */
  private readonly lastGoodByUri = new Map<string, CrdPreviewPipeline>()
  /** The artifact set currently shown (fresh or stale last-good) — the source
   *  for copy/save and the e2e `artifacts()` accessor. */
  private currentPipeline: CrdPreviewPipeline | undefined
  private lastError: string | undefined
  private lastRender: CrdRenderInfo | undefined
  private stale = false

  /**
   * Reveal the panel for `uri`, creating it (beside the active editor) on first
   * use and re-targeting the existing one otherwise — re-invoking never opens a
   * second panel.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    client: FlinkReactorClient,
    uri: string,
  ): void {
    if (CrdPreviewPanel.instance) {
      CrdPreviewPanel.instance.retarget(uri)
      CrdPreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      CrdPreviewPanel.viewType,
      CrdPreviewPanel.titleFor(uri),
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    )
    CrdPreviewPanel.instance = new CrdPreviewPanel(
      panel,
      extensionUri,
      client,
      uri,
    )
  }

  /** Re-target the open panel when the active editor switches to a different
   *  FlinkReactor pipeline (4.4). No-op when no panel is open. */
  static handleActiveEditor(uri: string): void {
    CrdPreviewPanel.instance?.retarget(uri)
  }

  /** The live panel, if any (e2e visibility). */
  static get active(): CrdPreviewPanel | undefined {
    return CrdPreviewPanel.instance
  }

  get render(): CrdRenderInfo | undefined {
    return this.lastRender
  }

  /** The currently rendered artifact set (id/label/filename/kind), for the e2e
   *  suite to assert the tab set without the YAML bodies. */
  get artifacts(): readonly CrdArtifactInfo[] {
    return (this.currentPipeline?.artifacts ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      filename: a.filename,
      kind: a.kind,
    }))
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly client: FlinkReactorClient,
    private uri: string,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "crd-preview.js"),
    )
    panel.webview.html = buildCrdHtml(panel.webview, scriptUri, getNonce())

    panel.webview.onDidReceiveMessage(
      (m: InboundMessage) => this.onMessage(m),
      undefined,
      this.disposables,
    )
    // Live refresh: re-pull on the server's debounced re-synthesis for our doc
    // (the same `flinkReactor/synthesized` signal the DAG + SQL panels use — no
    // second client-side debounce).
    this.disposables.push(
      client.onSynthesized(({ uri }) => {
        if (uri === this.uri) void this.refresh()
      }),
    )
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables)

    getOutputChannel().info(`CRD preview opened for ${basename(uri)}`)
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
    this.currentPipeline = undefined
    this.stale = false
    this.panel.title = CrdPreviewPanel.titleFor(uri)
    getOutputChannel().info(`CRD preview retargeted to ${basename(uri)}`)
    void this.refresh()
  }

  /** Pull the artifact set and post it (or a stale/error state) to the webview.
   *  Pure projection server-side — never triggers a re-synthesis. */
  async refresh(): Promise<void> {
    const model = await this.client.sendGraphRequest<CrdPreviewResponse>(
      CRD_PREVIEW_REQUEST,
      { uri: this.uri, version: this.renderedVersion },
    )
    if (!model) return

    const pipeline = model.pipelines[0]
    // Not synthesized yet: keep any last-good on screen, else show waiting.
    if (!pipeline) {
      if (!this.currentPipeline) this.post({ type: "empty" })
      return
    }

    if (pipeline.status === "ok") {
      // Drop a successful response older than what we already rendered (4.2).
      if (model.documentVersion < this.renderedVersion) return
      this.renderedVersion = model.documentVersion
      this.lastError = undefined
      this.stale = false
      this.lastGoodByUri.set(this.uri, pipeline)
      this.currentPipeline = pipeline
      this.post({
        type: "render",
        version: model.documentVersion,
        stale: false,
        pipeline,
      })
      return
    }

    // Synthesis is failing (or no synthesizable pipeline): keep the last-good
    // set behind a stale banner if we have one (6.2); else show the error (6.3).
    this.lastError =
      pipeline.error ??
      (pipeline.status === "no-pipeline"
        ? "No synthesizable FlinkReactor pipeline in this file."
        : "synthesis is failing")
    getOutputChannel().warn(
      `CRD preview: ${pipeline.status} for ${basename(this.uri)} — ${this.lastError}`,
    )
    const cached = this.lastGoodByUri.get(this.uri)
    if (cached) {
      this.stale = true
      this.currentPipeline = cached
      this.post({
        type: "render",
        version: model.documentVersion,
        stale: true,
        pipeline: cached,
        error: this.lastError,
      })
    } else {
      this.stale = false
      this.currentPipeline = undefined
      this.post({ type: "error", error: this.lastError })
    }
  }

  /** Switch the active tab from the host (drives the e2e tab-preservation
   *  assertion, since the sandboxed tab strip can't be clicked from the host). */
  selectTab(index: number): void {
    this.post({ type: "selectTab", index })
  }

  /** Copy an artifact's exact YAML to the clipboard (5.1). */
  async copyArtifact(artifactId: string): Promise<void> {
    const artifact = this.currentPipeline?.artifacts.find(
      (a) => a.id === artifactId,
    )
    if (!artifact) return
    await vscode.env.clipboard.writeText(artifact.yaml)
    vscode.window.setStatusBarMessage(
      `FlinkReactor: copied ${artifact.filename} to the clipboard.`,
      3000,
    )
  }

  /** Write one artifact to `dist/<pipeline>/<filename>` (5.2). */
  async saveArtifact(artifactId: string): Promise<void> {
    const pipeline = this.currentPipeline
    const artifact = pipeline?.artifacts.find((a) => a.id === artifactId)
    if (!pipeline || !artifact) return
    await this.writeArtifacts(pipeline.pipelineName, [artifact])
  }

  /** Write the whole set to `dist/<pipeline>/` (5.3). */
  async saveAll(): Promise<void> {
    const pipeline = this.currentPipeline
    if (!pipeline || pipeline.artifacts.length === 0) return
    await this.writeArtifacts(pipeline.pipelineName, pipeline.artifacts)
  }

  // ── Internals ─────────────────────────────────────────────────────

  private onMessage(message: InboundMessage): void {
    switch (message.type) {
      case "ready":
      case "requestRefresh":
        void this.refresh()
        return
      case "copy":
        void this.copyArtifact(message.artifactId)
        return
      case "save":
        void this.saveArtifact(message.artifactId)
        return
      case "saveAll":
        void this.saveAll()
        return
      case "showError":
        if (this.lastError) {
          void vscode.window.showWarningMessage(
            `FlinkReactor CRD preview is stale — synthesis is failing:\n${this.lastError}`,
          )
        }
        return
      case "rendered":
        this.lastRender = {
          ok: message.ok,
          version: message.version,
          pipelineName: message.pipelineName,
          pipelineKind: message.pipelineKind,
          tabCount: message.tabCount,
          activeTab: message.activeTab,
          activeFilename: message.activeFilename,
          stale: this.stale,
        }
        return
    }
  }

  /**
   * Write artifacts to `dist/<pipeline>/<filename>` under the project that owns
   * the previewed file, mirroring the `fr synth` layout (5.2/5.3). When no
   * FlinkReactor project resolves, fall back to a save-as picker (5.4).
   */
  private async writeArtifacts(
    pipelineName: string,
    artifacts: readonly CrdArtifact[],
  ): Promise<void> {
    const projectDir = this.projectDirForUri()
    if (!projectDir) {
      await this.saveAsFallback(artifacts)
      return
    }
    const dir = vscode.Uri.file(join(projectDir, "dist", pipelineName))
    try {
      await vscode.workspace.fs.createDirectory(dir)
      for (const a of artifacts) {
        await vscode.workspace.fs.writeFile(
          vscode.Uri.joinPath(dir, a.filename),
          Buffer.from(a.yaml, "utf-8"),
        )
      }
      vscode.window.setStatusBarMessage(
        `FlinkReactor: wrote ${artifacts.length} artifact(s) to dist/${pipelineName}/`,
        4000,
      )
    } catch (err) {
      getOutputChannel().error(`CRD preview save failed: ${String(err)}`)
      void vscode.window.showErrorMessage(
        `FlinkReactor: could not write to dist/${pipelineName}/ — ${String(err)}`,
      )
    }
  }

  /** Save-as fallback when no project context resolves (5.4). A single artifact
   *  prompts for a file; a whole set prompts for a target directory. */
  private async saveAsFallback(
    artifacts: readonly CrdArtifact[],
  ): Promise<void> {
    if (artifacts.length === 1) {
      const target = await vscode.window.showSaveDialog({
        saveLabel: "Save artifact",
        filters: { YAML: ["yaml", "yml"] },
      })
      if (!target) return
      await vscode.workspace.fs.writeFile(
        target,
        Buffer.from(artifacts[0].yaml, "utf-8"),
      )
      return
    }
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: "Save all here",
    })
    const dir = picked?.[0]
    if (!dir) return
    for (const a of artifacts) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(dir, a.filename),
        Buffer.from(a.yaml, "utf-8"),
      )
    }
  }

  /** The directory of the FlinkReactor project owning the previewed file. */
  private projectDirForUri(): string | undefined {
    try {
      const fsPath = vscode.Uri.parse(this.uri).fsPath
      return resolveProjectContext(dirname(fsPath))?.projectDir
    } catch {
      return undefined
    }
  }

  private post(message: OutboundMessage): void {
    void this.panel.webview.postMessage(message)
  }

  private static titleFor(uri: string): string {
    try {
      return `CRD — ${basename(vscode.Uri.parse(uri).fsPath)}`
    } catch {
      return "CRD Preview"
    }
  }

  private dispose(): void {
    CrdPreviewPanel.instance = undefined
    for (const d of this.disposables.splice(0)) d.dispose()
    this.panel.dispose()
  }
}
