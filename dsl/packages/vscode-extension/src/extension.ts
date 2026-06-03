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
import { GraphPanel, type RenderInfo } from "./graph/panel.js"
import {
  type SqlHighlightInfo,
  SqlPreviewPanel,
  type SqlRenderInfo,
} from "./preview/sql-preview-manager.js"
import { disposeOutputChannel, getOutputChannel } from "./ui/output.js"
import { StatusBar } from "./ui/status-bar.js"
import { discoverPipelines } from "./workspace/pipeline-discovery.js"
import {
  type ProjectContext,
  resolveProjectContext,
} from "./workspace/project-context.js"

let client: FlinkReactorClient | undefined
let statusBar: StatusBar | undefined

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
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<FlinkReactorApi> {
  const log = getOutputChannel()
  const project = locateProject()

  // Commands are always available (using a late-bound project lookup) so the
  // user can act even if activation raced ahead of the project being detected.
  registerCommands(context, locateProject)

  // Keep the `flinkReactor.isPipeline` context key (which gates the editor-title
  // DAG + SQL-preview actions) in sync with the active editor.
  updatePipelineContext()
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updatePipelineContext()),
    vscode.workspace.onDidOpenTextDocument(() => updatePipelineContext()),
    // DSL→SQL: drive any open SQL preview off the bound editor's caret.
    vscode.window.onDidChangeTextEditorSelection((e) => {
      void SqlPreviewPanel.handleSelection(e.textEditor)
    }),
    // Dispose a SQL preview when its bound document closes.
    vscode.workspace.onDidCloseTextDocument((doc) => {
      SqlPreviewPanel.handleDocumentClose(doc.uri.toString())
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
  )
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
