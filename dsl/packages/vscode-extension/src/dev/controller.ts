// Managed `fr dev` watch integration (cli-lifecycle-integration §6).
//
// `fr dev` is long-running and stateful (watch + local cluster); two
// instances would fight over ports/containers. This controller owns a single
// managed task per workspace: invoking Dev while one runs REVEALS the
// existing terminal instead of starting a second; a status bar item reflects
// running/stopped (clicking it stops the watch); status clears when the task
// exits for any reason. Phase derivation degrades to a simple
// running/stopped indicator (the CLI emits no structured phase stream yet —
// see the change's open questions).

import * as vscode from "vscode"
import type { CommandDescriptor } from "../cli/command-descriptor.js"
import {
  FLINK_REACTOR_TASK_TYPE,
  killLifecycleProcess,
  runLifecycleTask,
} from "../cli/task-provider.js"
import { getOutputChannel } from "../ui/output.js"

/** The live dev TaskExecution as VS Code tracks it. Matching by DEFINITION
 *  (type + verb), not object identity: the execution `executeTask` resolves
 *  with can differ in identity from the one in `vscode.tasks.taskExecutions`,
 *  and terminating the stale handle warns "Task to terminate not found". */
function liveDevExecution(): vscode.TaskExecution | undefined {
  return vscode.tasks.taskExecutions.find(
    (e) =>
      e.task.definition.type === FLINK_REACTOR_TASK_TYPE &&
      e.task.definition.verb === "dev",
  )
}

export class DevController {
  private readonly item: vscode.StatusBarItem
  private readonly disposables: vscode.Disposable[] = []
  private execution: vscode.TaskExecution | undefined

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98, // beside the environment switcher
    )
    this.item.command = "flinkReactor.stopDev"
    this.disposables.push(
      vscode.tasks.onDidEndTask((event) => {
        const definition = event.execution.task.definition
        if (
          definition.type === FLINK_REACTOR_TASK_TYPE &&
          definition.verb === "dev"
        ) {
          this.execution = undefined
          this.render()
          getOutputChannel().info("fr dev stopped")
        }
      }),
    )
    this.render()
  }

  get running(): boolean {
    return this.execution !== undefined || liveDevExecution() !== undefined
  }

  /** Start the managed dev task, or reveal the existing one. */
  async start(projectDir: string, env: string | undefined): Promise<void> {
    if (this.running) {
      // Reveal the existing dev terminal rather than spawning a second.
      const terminal = vscode.window.terminals.find((t) =>
        t.name.includes("dev"),
      )
      terminal?.show()
      getOutputChannel().info("fr dev already running — revealed its terminal")
      return
    }
    const descriptor: CommandDescriptor = {
      verb: "dev",
      ...(env ? { env } : {}),
    }
    const outcome = await runLifecycleTask(descriptor, projectDir)
    if (outcome.started) {
      this.execution = outcome.execution
      this.render()
    }
  }

  /** Stop the managed dev task (the status bar item's click action). The
   *  kill goes through the CLI process registry — the SIGTERM the CLI
   *  expects, so it can tear down its watcher/cluster — because the
   *  task-service `terminate()` handle can miss for ext-host tasks ("Task to
   *  terminate not found"). Killing the child closes the pseudoterminal,
   *  which ends the task and fires `onDidEndTask` → status clears. */
  stop(): void {
    const killed = killLifecycleProcess("dev")
    if (!killed) {
      // Fall back to the task-service handle, then report idle.
      const live = liveDevExecution() ?? this.execution
      if (!live) {
        void vscode.window.showInformationMessage(
          "FlinkReactor: fr dev is not running.",
        )
        return
      }
      live.terminate()
    }
  }

  private render(): void {
    if (this.running) {
      this.item.text = "$(radio-tower) fr dev: running"
      this.item.tooltip =
        "FlinkReactor dev watch is running — click to stop it."
      this.item.show()
    } else {
      this.item.hide()
    }
  }

  dispose(): void {
    if (!killLifecycleProcess("dev")) {
      ;(liveDevExecution() ?? this.execution)?.terminate()
    }
    for (const d of this.disposables.splice(0)) d.dispose()
    this.item.dispose()
  }
}
