import * as vscode from "vscode"
import { getOutputChannel } from "../ui/output.js"
import type { ProjectContext } from "../workspace/project-context.js"
import { computeTsconfigEdits } from "./tsconfig-editor.js"

type AutoConfigure = "prompt" | "always" | "never"

interface ConfigureOptions {
  /** Explicit command run: bypass the gate and report the outcome to the user. */
  readonly force: boolean
}

/**
 * Activation-time entry: ensure the ts-plugin is configured, honoring the
 * `flinkReactor.tsPlugin.autoConfigure` setting (`prompt` | `always` | `never`).
 */
export async function maybeConfigureTsPlugin(
  project: ProjectContext,
): Promise<void> {
  const mode = vscode.workspace
    .getConfiguration("flinkReactor")
    .get<AutoConfigure>("tsPlugin.autoConfigure", "prompt")
  if (mode === "never") return
  await configure(project, mode, { force: false })
}

/** Explicit `flinkReactor.configureTsPlugin` command: always attempt, report result. */
export async function configureTsPluginCommand(
  project: ProjectContext | null,
): Promise<void> {
  if (!project) {
    void vscode.window.showWarningMessage(
      "FlinkReactor: no flink-reactor.config.ts found in this workspace.",
    )
    return
  }
  await configure(project, "always", { force: true })
}

async function configure(
  project: ProjectContext,
  mode: AutoConfigure,
  opts: ConfigureOptions,
): Promise<void> {
  const log = getOutputChannel()
  if (!project.tsconfigPath) {
    if (opts.force) {
      void vscode.window.showWarningMessage(
        "FlinkReactor: no tsconfig.json found to configure.",
      )
    }
    return
  }

  const uri = vscode.Uri.file(project.tsconfigPath)
  const doc = await vscode.workspace.openTextDocument(uri)
  const text = doc.getText()
  const result = computeTsconfigEdits(text)

  if (result.unparseable) {
    if (opts.force) {
      void vscode.window.showErrorMessage(
        "FlinkReactor: tsconfig.json could not be parsed; please configure the ts-plugin manually.",
      )
    }
    return
  }
  if (!result.changed) {
    if (opts.force) {
      void vscode.window.showInformationMessage(
        "FlinkReactor: ts-plugin is already configured.",
      )
    }
    return
  }

  // Gate: in prompt mode (when not an explicit command), ask before editing.
  if (mode === "prompt" && !opts.force) {
    const CONFIGURE = "Configure"
    const NEVER = "Never for this workspace"
    const pick = await vscode.window.showInformationMessage(
      "Add @flink-reactor/ts-plugin to tsconfig.json so FlinkReactor's editor features activate?",
      CONFIGURE,
      NEVER,
    )
    if (pick === NEVER) {
      await vscode.workspace
        .getConfiguration("flinkReactor")
        .update(
          "tsPlugin.autoConfigure",
          "never",
          vscode.ConfigurationTarget.Workspace,
        )
      return
    }
    if (pick !== CONFIGURE) return // dismissed
  }

  // A single full-range replace: `newText` differs from `text` only in the
  // spans jsonc-parser touched, so comments/formatting are preserved while the
  // change remains one undoable `WorkspaceEdit`.
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(text.length),
  )
  const edit = new vscode.WorkspaceEdit()
  edit.replace(uri, fullRange, result.newText)
  const applied = await vscode.workspace.applyEdit(edit)
  if (!applied) {
    log.error(`Failed to apply tsconfig edit to ${project.tsconfigPath}`)
    return
  }
  await doc.save()
  log.info(`Configured @flink-reactor/ts-plugin in ${project.tsconfigPath}`)
  void vscode.window.showInformationMessage(
    "FlinkReactor: ts-plugin configured. Use the workspace TypeScript version to activate it.",
  )
}
