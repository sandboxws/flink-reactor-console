import { join, relative } from "node:path"
import * as vscode from "vscode"
import { getOutputChannel } from "../ui/output.js"
import type { ProjectContext } from "../workspace/project-context.js"
import {
  hasWorkspaceTypeScript,
  shouldPromptForWorkspaceTs,
} from "./ts-version-prompt.js"

const DISMISS_PREFIX = "flinkReactor.tsdkPrompt.dismissed:"

/** Per-workspace dismissal key, stored in global state. */
function dismissedKey(projectDir: string): string {
  return `${DISMISS_PREFIX}${projectDir}`
}

/** VS Code expects forward-slash `typescript.tsdk` paths on every platform. */
function toPosix(p: string): string {
  return p.split(/[\\/]/).join("/")
}

/**
 * Activation-time entry: prompt once per workspace to switch to the project's
 * TypeScript so the ts-plugin can load.
 */
export async function maybePromptWorkspaceTypeScript(
  context: vscode.ExtensionContext,
  project: ProjectContext,
): Promise<void> {
  const state = {
    workspaceTypeScriptPresent: hasWorkspaceTypeScript(project.projectDir),
    tsdkConfigured: Boolean(
      vscode.workspace.getConfiguration("typescript").get<string>("tsdk"),
    ),
    dismissed: context.globalState.get<boolean>(
      dismissedKey(project.projectDir),
      false,
    ),
  }
  if (!shouldPromptForWorkspaceTs(state)) return
  await prompt(context, project)
}

/** Explicit `flinkReactor.useWorkspaceTypeScript` command: ignores the dismissal. */
export async function useWorkspaceTypeScriptCommand(
  context: vscode.ExtensionContext,
  project: ProjectContext | null,
): Promise<void> {
  if (!project) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: no flink-reactor.config.ts found in this workspace.",
    )
    return
  }
  if (!hasWorkspaceTypeScript(project.projectDir)) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: no workspace TypeScript found. Install `typescript` in your project first.",
    )
    return
  }
  await prompt(context, project)
}

async function prompt(
  context: vscode.ExtensionContext,
  project: ProjectContext,
): Promise<void> {
  const USE = "Use Workspace Version"
  const DISMISS = "Don't Show Again"
  const pick = await vscode.window.showInformationMessage(
    "FlinkReactor's ts-plugin needs your workspace TypeScript version, but VS Code is using its bundled TypeScript. Switch to the workspace version?",
    USE,
    DISMISS,
  )
  if (pick === DISMISS) {
    await context.globalState.update(dismissedKey(project.projectDir), true)
    return
  }
  if (pick !== USE) return

  // `typescript.tsdk` is resolved relative to the workspace folder.
  const folder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(project.projectDir),
  )
  const base = folder?.uri.fsPath ?? project.projectDir
  const tsdk =
    toPosix(
      relative(
        base,
        join(project.projectDir, "node_modules", "typescript", "lib"),
      ),
    ) || "node_modules/typescript/lib"

  await vscode.workspace
    .getConfiguration("typescript")
    .update("tsdk", tsdk, vscode.ConfigurationTarget.Workspace)
  getOutputChannel().info(`Set typescript.tsdk = ${tsdk}`)

  const RELOAD = "Reload Window"
  const reload = await vscode.window.showInformationMessage(
    "Workspace TypeScript selected. Reload the window to activate the FlinkReactor ts-plugin.",
    RELOAD,
  )
  if (reload === RELOAD) {
    await vscode.commands.executeCommand("workbench.action.reloadWindow")
  }
}
