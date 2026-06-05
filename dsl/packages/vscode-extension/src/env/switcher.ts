// The status-bar environment switcher (cli-lifecycle-integration §4).
//
// Authors target one environment at a time and re-type `-e <env>` constantly;
// this makes it an explicit, per-workspace-persisted, always-visible
// selection: `flinkReactor.selectEnvironment` quick-picks among the
// environments discovered from `flink-reactor.config.ts`, the status bar
// shows the active one (or "no env"), and every lifecycle descriptor gains
// `--env <selected>` while a selection is active. When nothing is selected,
// commands run without `--env` and inherit the CLI's own default.

import * as vscode from "vscode"
import { getOutputChannel } from "../ui/output.js"
import { discoverEnvironments } from "./discover.js"

const STATE_KEY = "flinkReactor.activeEnvironment"

export class EnvironmentSwitcher {
  private readonly item: vscode.StatusBarItem

  constructor(
    private readonly memento: vscode.Memento,
    private readonly getProjectDir: () => string | undefined,
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99, // just right of the FlinkReactor server item (priority 100)
    )
    this.item.command = "flinkReactor.selectEnvironment"
    this.render()
    this.item.show()
  }

  /** The persisted active environment, or `undefined` when unset. */
  get active(): string | undefined {
    const value = this.memento.get<string>(STATE_KEY)
    return value && value.length > 0 ? value : undefined
  }

  /** Quick-pick among discovered environments (plus a clear option). Accepts
   *  an explicit `env` to skip the picker — the programmatic/e2e path. */
  async select(env?: string): Promise<void> {
    if (env !== undefined) {
      await this.apply(env.length > 0 ? env : undefined)
      return
    }
    const projectDir = this.getProjectDir()
    const discovered = projectDir ? discoverEnvironments(projectDir) : []
    const items: vscode.QuickPickItem[] = discovered.map((name) => ({
      label: name,
      description: name === this.active ? "active" : undefined,
    }))
    items.push({
      label: "$(clear-all) No environment",
      description: "run commands without --env",
    })
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder:
        discovered.length > 0
          ? "Select the active FlinkReactor environment"
          : "No environments discovered in flink-reactor.config.ts",
    })
    if (!picked) return
    await this.apply(
      picked.label.startsWith("$(clear-all)") ? undefined : picked.label,
    )
  }

  private async apply(env: string | undefined): Promise<void> {
    await this.memento.update(STATE_KEY, env ?? "")
    this.render()
    getOutputChannel().info(
      env
        ? `Active environment: ${env} (subsequent commands run with --env ${env})`
        : "Active environment cleared (commands run without --env)",
    )
  }

  private render(): void {
    const env = this.active
    this.item.text = env ? `$(globe) env: ${env}` : "$(globe) env: none"
    this.item.tooltip = env
      ? `FlinkReactor commands run with --env ${env}. Click to switch.`
      : "No active FlinkReactor environment — commands run without --env. Click to select."
  }

  dispose(): void {
    this.item.dispose()
  }
}
