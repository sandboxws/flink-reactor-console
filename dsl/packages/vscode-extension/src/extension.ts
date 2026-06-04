import { dirname } from "node:path"
import * as vscode from "vscode"
import { FlinkReactorClient } from "./client/launch.js"
import {
  configureTsPluginCommand,
  maybeConfigureTsPlugin,
} from "./config/configure-ts-plugin.js"
import {
  maybePromptWorkspaceTypeScript,
  useWorkspaceTypeScriptCommand,
} from "./config/use-workspace-typescript.js"
import {
  type DesignerEditOutcome,
  DesignerPanel,
  type DesignerRenderInfo,
} from "./designer/panel.js"
import type {
  DesignerEdit,
  DesignerModelResponse,
} from "./designer/protocol.js"
import {
  DEEP_VALIDATE_REQUEST,
  type DeepValidateResponse,
} from "./gateway/protocol.js"
import { GatewayStatusItem } from "./gateway/status.js"
import {
  GraphPanel,
  type RenderInfo,
  type TapOverlayInfo,
} from "./graph/panel.js"
import {
  type CrdArtifactInfo,
  CrdPreviewPanel,
  type CrdRenderInfo,
} from "./preview/crd-preview-manager.js"
import {
  type SqlHighlightInfo,
  SqlPreviewPanel,
  type SqlRenderInfo,
} from "./preview/sql-preview-manager.js"
import { SqlHighlightingController } from "./sql/highlighting-controller.js"
import { type TapRenderInfo, TapsPanel } from "./taps/panel.js"
import type { TapManifestResponse } from "./taps/protocol.js"
import type { SchemaTableInfo, SchemaTreeLocation } from "./tree/protocol.js"
import {
  revealLocation,
  REFRESH_COMMAND as SCHEMA_REFRESH_COMMAND,
  REVEAL_COMMAND as SCHEMA_REVEAL_COMMAND,
  SCHEMA_VIEW_ID,
  SchemaExplorerProvider,
} from "./tree/schema-explorer.js"
import { disposeOutputChannel, getOutputChannel } from "./ui/output.js"
import { StatusBar } from "./ui/status-bar.js"
import { discoverPipelines } from "./workspace/pipeline-discovery.js"
import {
  type ProjectContext,
  resolveProjectContext,
} from "./workspace/project-context.js"

let client: FlinkReactorClient | undefined
let statusBar: StatusBar | undefined
let schemaExplorer: SchemaExplorerProvider | undefined
let gatewayStatus: GatewayStatusItem | undefined

/** The extension's public API (also used by the e2e suite to observe the DAG
 *  panel, whose sandboxed webview is otherwise unreadable from the host). */
export interface FlinkReactorApi {
  readonly dag: {
    /** The webview's last render acknowledgement, or `undefined` if closed. */
    renderInfo(): RenderInfo | undefined
    /** Drive the click-to-source path for a node (what a webview click posts). */
    revealNode(nodeId: string): Promise<void>
    /** Whether a DAG panel is currently open. */
    isOpen(): boolean
  }
  readonly sqlPreview: {
    /** The webview's last render acknowledgement for a document, if open. */
    renderInfo(uri: string): SqlRenderInfo | undefined
    /** The webview's last DSL→SQL highlight acknowledgement (caret → spans). */
    lastHighlight(uri: string): SqlHighlightInfo | undefined
    /** Drive the SQL→DSL click-to-source path (what a webview span click posts). */
    revealNode(uri: string, nodeId: string): Promise<void>
    /** Whether a SQL preview is open for the document. */
    isOpen(uri: string): boolean
    /** Total open SQL preview panels (assert no duplicates). */
    count(): number
  }
  readonly crdPreview: {
    /** The webview's last render acknowledgement, or `undefined` if closed. */
    renderInfo(): CrdRenderInfo | undefined
    /** The currently rendered artifact set (tab id/label/filename/kind). */
    artifacts(): readonly CrdArtifactInfo[]
    /** Switch the active tab (drives tab-preservation assertions). */
    selectTab(index: number): void
    /** Drive the copy action for an artifact (what a webview button posts). */
    copy(artifactId: string): Promise<void>
    /** Drive "save to dist/" for one artifact / the whole set. */
    save(artifactId: string): Promise<void>
    saveAll(): Promise<void>
    /** Whether the CRD preview panel is currently open. */
    isOpen(): boolean
  }
  readonly schemaTree: {
    /** The Schema Explorer's current source/sink tables (the rendered model). */
    tables(): readonly SchemaTableInfo[]
    /** The pipeline URI the tree is bound to, if any. */
    boundUri(): string | undefined
    /** Whether the tree is showing last-good tables behind a stale indicator. */
    isStale(): boolean
    /** Drive the reveal path for a tree item by id (the native tree's items are
     *  not clickable from the host). Resolves to whether navigation occurred. */
    revealItem(id: string): Promise<boolean>
    /** Force a re-request of `flinkReactor/schemaTree` for the bound document. */
    refresh(): Promise<void>
  }
  readonly taps: {
    /** The tap webview's last render acknowledgement, or `undefined` if closed. */
    renderInfo(): TapRenderInfo | undefined
    /** The last tap manifest the panel pulled (strategy/schema/SQL assertions). */
    manifest(): TapManifestResponse | undefined
    /** Drive the tap click-to-source path (what a webview click posts). */
    revealTap(nodeId: string): Promise<void>
    /** Whether a tap panel is currently open. */
    isOpen(): boolean
    /** The DAG overlay's toggle state + last application ack. */
    overlayInfo(): TapOverlayInfo | undefined
  }
  readonly designer: {
    /** The designer webview's last render acknowledgement. */
    renderInfo(): DesignerRenderInfo | undefined
    /** The last designer model the panel pulled (props/fileKind assertions). */
    model(): DesignerModelResponse | undefined
    /** Drive one edit intent through the panel (what the webview posts). */
    applyEdit(edit: DesignerEdit): Promise<DesignerEditOutcome | undefined>
    /** The last `applyDesignerEdit` outcome (applied / refused / error). */
    lastEdit(): DesignerEditOutcome | undefined
    /** Drive the click-to-source path for a node. */
    revealNode(nodeId: string): Promise<void>
    /** Whether a designer panel is currently open. */
    isOpen(): boolean
  }
}

const api: FlinkReactorApi = {
  dag: {
    renderInfo: () => GraphPanel.active?.render,
    revealNode: (nodeId) =>
      GraphPanel.active?.revealNode(nodeId) ?? Promise.resolve(),
    isOpen: () => GraphPanel.active !== undefined,
  },
  sqlPreview: {
    renderInfo: (uri) => SqlPreviewPanel.forUri(uri)?.render,
    lastHighlight: (uri) => SqlPreviewPanel.forUri(uri)?.lastHighlight,
    revealNode: (uri, nodeId) =>
      SqlPreviewPanel.forUri(uri)?.revealNode(nodeId) ?? Promise.resolve(),
    isOpen: (uri) => SqlPreviewPanel.forUri(uri) !== undefined,
    count: () => SqlPreviewPanel.count,
  },
  crdPreview: {
    renderInfo: () => CrdPreviewPanel.active?.render,
    artifacts: () => CrdPreviewPanel.active?.artifacts ?? [],
    selectTab: (index) => CrdPreviewPanel.active?.selectTab(index),
    copy: (artifactId) =>
      CrdPreviewPanel.active?.copyArtifact(artifactId) ?? Promise.resolve(),
    save: (artifactId) =>
      CrdPreviewPanel.active?.saveArtifact(artifactId) ?? Promise.resolve(),
    saveAll: () => CrdPreviewPanel.active?.saveAll() ?? Promise.resolve(),
    isOpen: () => CrdPreviewPanel.active !== undefined,
  },
  schemaTree: {
    tables: () => SchemaExplorerProvider.current?.snapshot ?? [],
    boundUri: () => SchemaExplorerProvider.current?.boundUri,
    isStale: () => SchemaExplorerProvider.current?.isStale ?? false,
    revealItem: (id) =>
      SchemaExplorerProvider.current?.revealById(id) ?? Promise.resolve(false),
    refresh: () =>
      SchemaExplorerProvider.current?.refresh() ?? Promise.resolve(),
  },
  taps: {
    renderInfo: () => TapsPanel.active?.render,
    manifest: () => TapsPanel.active?.manifest,
    revealTap: (nodeId) =>
      TapsPanel.active?.revealTap(nodeId) ?? Promise.resolve(),
    isOpen: () => TapsPanel.active !== undefined,
    overlayInfo: () => GraphPanel.active?.tapOverlay,
  },
  designer: {
    renderInfo: () => DesignerPanel.active?.render,
    model: () => DesignerPanel.active?.model,
    applyEdit: (edit) =>
      DesignerPanel.active?.applyEdit(edit) ?? Promise.resolve(undefined),
    lastEdit: () => DesignerPanel.active?.lastEditOutcome,
    revealNode: (nodeId) =>
      DesignerPanel.active?.revealNode(nodeId) ?? Promise.resolve(),
    isOpen: () => DesignerPanel.active !== undefined,
  },
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<FlinkReactorApi> {
  const log = getOutputChannel()
  const project = locateProject()

  // Commands are always available (using a late-bound project lookup) so the
  // user can act even if activation raced ahead of the project being detected.
  registerCommands(context, locateProject)

  // Embedded-SQL highlighting opt-out (embedded-sql-highlighting, Tier-2): honor
  // `flinkReactor.sql.highlighting` for the TextMate layer. Registered before
  // the project gate so the opt-out applies to any open pipeline `.tsx`, even
  // when no FlinkReactor project is detected (the grammar is injected globally).
  context.subscriptions.push(new SqlHighlightingController().register())

  // Schema Explorer: register the view + provider up front (it shows a
  // placeholder without a project/server). The provider reads `client` lazily,
  // so it starts producing data as soon as the server is up.
  schemaExplorer = new SchemaExplorerProvider(() => client)
  context.subscriptions.push(
    vscode.window.createTreeView(SCHEMA_VIEW_ID, {
      treeDataProvider: schemaExplorer,
      showCollapseAll: true,
    }),
    { dispose: () => schemaExplorer?.dispose() },
  )
  void schemaExplorer.bind(activePipelineUri())

  // Keep the `flinkReactor.isPipeline` context key (which gates the editor-title
  // DAG + SQL-preview actions) in sync with the active editor.
  updatePipelineContext()
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updatePipelineContext()
      // Re-target the CRD + SQL previews when the active editor switches to a
      // different FlinkReactor pipeline (they follow the focused pipeline).
      if (editor && isPipelineDocument(editor.document)) {
        const uri = editor.document.uri.toString()
        CrdPreviewPanel.handleActiveEditor(uri)
        SqlPreviewPanel.handleActiveEditor(uri)
      }
      // 7.4 — re-bind the Schema Explorer to the newly active pipeline.
      void schemaExplorer?.bind(activePipelineUri())
    }),
    vscode.workspace.onDidOpenTextDocument(() => updatePipelineContext()),
    // DSL→SQL: drive the open SQL preview off the bound editor's caret.
    vscode.window.onDidChangeTextEditorSelection((e) => {
      void SqlPreviewPanel.handleSelection(e.textEditor)
    }),
  )

  if (!project) {
    log.info(
      "No flink-reactor.config.ts found in the workspace; FlinkReactor features are dormant until a project is opened.",
    )
    return api
  }

  log.info(`FlinkReactor project: ${project.projectDir}`)
  const pipelines = discoverPipelines(project.projectDir)
  const names = pipelines.map((p) => p.name).join(", ") || "none"
  log.info(`Discovered ${pipelines.length} pipeline(s): ${names}`)

  statusBar = new StatusBar()
  context.subscriptions.push({ dispose: () => statusBar?.dispose() })

  client = new FlinkReactorClient(project, context.extensionPath, statusBar)
  await client.start()
  context.subscriptions.push(client.watchConfiguration())
  context.subscriptions.push({ dispose: () => void client?.dispose() })

  // 7.3 — live refresh: re-request the schema tree whenever the server reports a
  // fresh synthesis for the bound pipeline (its existing debounced re-synthesis).
  context.subscriptions.push(
    client.onSynthesized(({ uri }) => {
      if (uri === schemaExplorer?.boundUri) void schemaExplorer.refresh()
    }),
  )

  // Gateway-state status item (gateway-validation): renders the server's
  // deep-validation state; visible only while flinkReactor.gateway.enabled.
  // (Work-done progress for a pass is rendered by vscode-languageclient.)
  gatewayStatus = new GatewayStatusItem()
  context.subscriptions.push(
    { dispose: () => gatewayStatus?.dispose() },
    client.onGatewayState(({ state, message }) =>
      gatewayStatus?.update(state, message),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("flinkReactor.gateway")) gatewayStatus?.sync()
    }),
  )
  // The view bound before the server existed (returning no data); now that it is
  // up, pull the tree for the active pipeline.
  void schemaExplorer?.refresh()

  // Onboarding automation — both are non-blocking and self-gating.
  void maybeConfigureTsPlugin(project)
  void maybePromptWorkspaceTypeScript(context, project)

  return api
}

export async function deactivate(): Promise<void> {
  await client?.dispose()
  client = undefined
  statusBar?.dispose()
  statusBar = undefined
  gatewayStatus?.dispose()
  gatewayStatus = undefined
  disposeOutputChannel()
}

/**
 * Find the active FlinkReactor project: prefer the directory of the focused
 * file (so opening a nested pipeline entry resolves its own project), then fall
 * back to each workspace folder root.
 */
function locateProject(): ProjectContext | null {
  const active = vscode.window.activeTextEditor?.document
  if (active && active.uri.scheme === "file") {
    const ctx = resolveProjectContext(dirname(active.uri.fsPath))
    if (ctx) return ctx
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const ctx = resolveProjectContext(folder.uri.fsPath)
    if (ctx) return ctx
  }
  return null
}

function registerCommands(
  context: vscode.ExtensionContext,
  getProject: () => ProjectContext | null,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("flinkReactor.configureTsPlugin", () =>
      configureTsPluginCommand(getProject()),
    ),
    vscode.commands.registerCommand("flinkReactor.useWorkspaceTypeScript", () =>
      useWorkspaceTypeScriptCommand(context, getProject()),
    ),
    vscode.commands.registerCommand("flinkReactor.restartServer", () =>
      client?.restart(),
    ),
    vscode.commands.registerCommand("flinkReactor.showOutput", () =>
      getOutputChannel().show(),
    ),
    vscode.commands.registerCommand("flinkReactor.openGraph", () =>
      openGraphCommand(context.extensionUri),
    ),
    vscode.commands.registerCommand("flinkReactor.showSqlPreview", () =>
      openSqlPreviewCommand(context.extensionUri),
    ),
    vscode.commands.registerCommand("flinkReactor.openCrdPreview", () =>
      openCrdPreviewCommand(context.extensionUri),
    ),
    // Schema Explorer: reveal an item's declaration (driven by the tree item's
    // command) and a manual refresh (the view/title button).
    vscode.commands.registerCommand(
      SCHEMA_REVEAL_COMMAND,
      (loc?: SchemaTreeLocation) => revealLocation(loc),
    ),
    vscode.commands.registerCommand(SCHEMA_REFRESH_COMMAND, () =>
      schemaExplorer?.refresh(),
    ),
    // Gateway deep validation: one explicit pass for the active pipeline.
    vscode.commands.registerCommand("flinkReactor.deepValidate", () =>
      deepValidateCommand(),
    ),
    // Tap visualization (Tier-3 feature 13): the tap panel + the DAG overlay.
    vscode.commands.registerCommand("flinkReactor.openTaps", () =>
      openTapsCommand(context.extensionUri),
    ),
    vscode.commands.registerCommand("flinkReactor.toggleTapOverlay", () =>
      toggleTapOverlayCommand(),
    ),
    // Visual designer (Tier-3 feature 15): the palette/canvas/forms webview.
    vscode.commands.registerCommand("flinkReactor.openDesigner", () =>
      openDesignerCommand(context.extensionUri),
    ),
  )
}

/** Open (or reveal) the visual designer for the active pipeline. */
function openDesignerCommand(extensionUri: vscode.Uri): void {
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline inside a FlinkReactor project first.",
    )
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor || !isPipelineDocument(editor.document)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the active editor is not a pipeline (.tsx importing @flink-reactor/dsl).",
    )
    return
  }
  DesignerPanel.createOrShow(
    extensionUri,
    client,
    editor.document.uri.toString(),
  )
}

/** Open (or reveal) the tap panel for the active pipeline. */
function openTapsCommand(extensionUri: vscode.Uri): void {
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline inside a FlinkReactor project first.",
    )
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor || !isPipelineDocument(editor.document)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the active editor is not a pipeline (.tsx importing @flink-reactor/dsl).",
    )
    return
  }
  TapsPanel.createOrShow(extensionUri, client, editor.document.uri.toString())
}

/** Toggle the tap overlay on the open DAG panel (badges on tapped nodes). */
async function toggleTapOverlayCommand(): Promise<void> {
  const panel = GraphPanel.active
  if (!panel) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open the Pipeline DAG first (FlinkReactor: Open Pipeline DAG).",
    )
    return
  }
  const active = await panel.toggleTapOverlay()
  vscode.window.setStatusBarMessage(
    active
      ? "$(eye) FlinkReactor: tap overlay on"
      : "FlinkReactor: tap overlay off",
    4000,
  )
}

/** Run one gateway deep-validation pass for the active pipeline and surface
 *  the outcome. Failures arrive as data (the server already showed its own
 *  warning notice for gateway-level failures), so this stays gentle. */
async function deepValidateCommand(): Promise<void> {
  const uri = activePipelineUri()
  if (!uri) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline .tsx to deep validate.",
    )
    return
  }
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the language server is not running.",
    )
    return
  }
  const response = await client.sendGraphRequest<DeepValidateResponse>(
    DEEP_VALIDATE_REQUEST,
    { uri },
  )
  if (!response) return
  switch (response.status) {
    case "clean":
      vscode.window.setStatusBarMessage(
        `$(check) FlinkReactor: deep validation passed${response.fromCache ? " (cached)" : ""}`,
        5000,
      )
      return
    case "errors":
      vscode.window.setStatusBarMessage(
        `$(error) FlinkReactor: deep validation found ${response.errorCount} planner error(s) — see Problems`,
        8000,
      )
      return
    case "skipped":
      if (response.skipReason === "disabled") {
        const pick = await vscode.window.showInformationMessage(
          "FlinkReactor deep validation is disabled. Enable flinkReactor.gateway.enabled and set the SQL Gateway endpoint to use it.",
          "Open Settings",
        )
        if (pick) {
          void vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "flinkReactor.gateway",
          )
        }
      }
      return
    default:
      // "failed" — the server already raised its notice + status state.
      return
  }
}

/** The active editor's URI when it is a FlinkReactor pipeline, else `undefined`
 *  — what the Schema Explorer binds to. */
function activePipelineUri(): string | undefined {
  const doc = vscode.window.activeTextEditor?.document
  return doc && isPipelineDocument(doc) ? doc.uri.toString() : undefined
}

/** Open (or reveal) the DAG panel for the active pipeline. */
function openGraphCommand(extensionUri: vscode.Uri): void {
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline inside a FlinkReactor project first.",
    )
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor || !isPipelineDocument(editor.document)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the active editor is not a pipeline (.tsx importing @flink-reactor/dsl).",
    )
    return
  }
  GraphPanel.createOrShow(extensionUri, client, editor.document.uri.toString())
}

/** Open (or reveal) the read-only SQL preview for the active pipeline. */
function openSqlPreviewCommand(extensionUri: vscode.Uri): void {
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline inside a FlinkReactor project first.",
    )
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor || !isPipelineDocument(editor.document)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the active editor is not a pipeline (.tsx importing @flink-reactor/dsl).",
    )
    return
  }
  SqlPreviewPanel.createOrShow(
    extensionUri,
    client,
    editor.document.uri.toString(),
  )
}

/** Open (or reveal) the read-only tabbed CRD/artifact-set preview for the
 *  active pipeline. */
function openCrdPreviewCommand(extensionUri: vscode.Uri): void {
  if (!client) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: open a pipeline inside a FlinkReactor project first.",
    )
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor || !isPipelineDocument(editor.document)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: the active editor is not a pipeline (.tsx importing @flink-reactor/dsl).",
    )
    return
  }
  CrdPreviewPanel.createOrShow(
    extensionUri,
    client,
    editor.document.uri.toString(),
  )
}

/** A FlinkReactor pipeline document: a `.tsx` importing the DSL (mirrors the
 *  server's `isPipelineDocument` gate). */
function isPipelineDocument(doc: vscode.TextDocument): boolean {
  if (
    doc.languageId !== "typescriptreact" &&
    !doc.uri.fsPath.endsWith(".tsx")
  ) {
    return false
  }
  return /from\s+["']@flink-reactor\/dsl/.test(doc.getText())
}

/** Drive the `flinkReactor.isPipeline` context key off the active editor so the
 *  editor-title DAG action only shows for pipeline files. */
function updatePipelineContext(): void {
  const doc = vscode.window.activeTextEditor?.document
  const isPipeline = !!doc && isPipelineDocument(doc)
  void vscode.commands.executeCommand(
    "setContext",
    "flinkReactor.isPipeline",
    isPipeline,
  )
}
