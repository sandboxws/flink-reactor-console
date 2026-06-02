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
import { disposeOutputChannel, getOutputChannel } from "./ui/output.js"
import { StatusBar } from "./ui/status-bar.js"
import { discoverPipelines } from "./workspace/pipeline-discovery.js"
import {
  type ProjectContext,
  resolveProjectContext,
} from "./workspace/project-context.js"

let client: FlinkReactorClient | undefined
let statusBar: StatusBar | undefined

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const log = getOutputChannel()
  const project = locateProject()

  // Commands are always available (using a late-bound project lookup) so the
  // user can act even if activation raced ahead of the project being detected.
  registerCommands(context, locateProject)

  if (!project) {
    log.info(
      "No flink-reactor.config.ts found in the workspace; FlinkReactor features are dormant until a project is opened.",
    )
    return
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
  )
}
