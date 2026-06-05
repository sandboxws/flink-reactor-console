// The `flink-reactor` task provider + lifecycle execution (tasks 1.3, 7.x).
//
// Every wrapped CLI command runs as a VS Code task so the exact command line
// is visible, the run is cancelable, and the exit code is surfaced — but the
// execution is a `CustomExecution` pseudoterminal that spawns the resolved
// binary itself rather than a `ProcessExecution`. Empirically (VS Code
// 1.123), declaratively-matched task problems never CLEAR on a re-run (the
// matcher's `"clear": true` notwithstanding) and a background task's
// terminal is unreachable for termination from the extension host. Owning
// the process gives all three behaviors deterministically:
//   • output streams to the task terminal AND through the SAME
//     `$flink-reactor` pattern (`problem-matcher.ts` — single source of
//     truth with the manifest contribution), landing entries in the
//     Problems panel under the `flink-reactor-cli` source;
//   • every task start clears the previous CLI run's entries, so a clean
//     run leaves the Problems panel empty;
//   • cancel/terminate closes the pty, which kills the child — and a
//     registry of live processes gives the dev controller a kill handle
//     that cannot miss.
//
// The manifest still contributes the `$flink-reactor` matcher (the spec'd
// declarative contract — usable from a hand-written `tasks.json`); the
// extension's own tasks do not attach it, so entries are never doubled.
// Non-zero exits surface via a notification + the output channel; the binary
// is resolved fresh per run and a not-found result short-circuits with the
// actionable message before any process spawns.

import { type ChildProcess, spawn } from "node:child_process"
import { isAbsolute, join } from "node:path"
import * as vscode from "vscode"
import { getOutputChannel } from "../ui/output.js"
import {
  buildArgs,
  type CommandDescriptor,
  descriptorIdentity,
  LIFECYCLE_VERBS,
} from "./command-descriptor.js"
import { type ParsedProblem, parseProblemLine } from "./problem-matcher.js"
import { resolveCliBinary } from "./resolve-binary.js"

export const FLINK_REACTOR_TASK_TYPE = "flink-reactor"

/** The Problems-panel source for CLI-run findings — DISTINCT from the
 *  language server's `flink-reactor` so the two never double-report. */
export const CLI_DIAGNOSTIC_SOURCE = "flink-reactor-cli"

interface FlinkReactorTaskDefinition extends vscode.TaskDefinition {
  readonly type: typeof FLINK_REACTOR_TASK_TYPE
  readonly verb: string
  readonly pipeline?: string
  readonly env?: string
  readonly flags?: readonly string[]
}

function cliPathSetting(): string {
  return (
    vscode.workspace.getConfiguration("flinkReactor").get<string>("cliPath") ??
    ""
  )
}

// ── CLI diagnostics (the Problems-panel channel the extension owns) ──

let cliDiagnostics: vscode.DiagnosticCollection | undefined

function diagnostics(): vscode.DiagnosticCollection {
  cliDiagnostics ??= vscode.languages.createDiagnosticCollection(
    CLI_DIAGNOSTIC_SOURCE,
  )
  return cliDiagnostics
}

/** Live child processes by descriptor identity — the kill handles cancel and
 *  the dev controller use (the task-service execution handle can miss). */
const liveProcesses = new Map<string, () => void>()

/** Kill every live CLI process for a verb (the dev controller's stop). */
export function killLifecycleProcess(verb: string): boolean {
  let killed = false
  for (const [key, kill] of liveProcesses) {
    if (key.startsWith(`${verb}|`)) {
      kill()
      killed = true
    }
  }
  return killed
}

// ── Pseudoterminal execution ────────────────────────────────────────

function createPty(
  descriptor: CommandDescriptor,
  binaryPath: string,
  projectDir: string,
): vscode.Pseudoterminal {
  const writeEmitter = new vscode.EventEmitter<string>()
  const closeEmitter = new vscode.EventEmitter<number>()
  const args = buildArgs(descriptor)
  const identity = descriptorIdentity(descriptor)
  let child: ChildProcess | undefined
  let pending = ""
  const problems: ParsedProblem[] = []

  const consume = (chunk: Buffer | string): void => {
    const text = chunk.toString()
    writeEmitter.fire(text.replace(/\r?\n/g, "\r\n"))
    pending += text
    let newline = pending.indexOf("\n")
    while (newline !== -1) {
      const line = pending.slice(0, newline).replace(/\r$/, "")
      pending = pending.slice(newline + 1)
      const parsed = parseProblemLine(line)
      if (parsed) problems.push(parsed)
      newline = pending.indexOf("\n")
    }
  }

  return {
    onDidWrite: writeEmitter.event,
    onDidClose: closeEmitter.event,
    open: () => {
      // A new CLI run owns the Problems channel: the previous run's entries
      // clear NOW, so a clean run ends with an empty panel (task 2.3).
      diagnostics().clear()
      // The exact command line, visible in the terminal (task 7.1).
      writeEmitter.fire(`> flink-reactor ${args.join(" ")}\r\n\r\n`)
      child = spawn(binaryPath, args, { cwd: projectDir })
      child.stdout?.on("data", consume)
      child.stderr?.on("data", consume)
      child.on("error", (err) => {
        writeEmitter.fire(
          `\r\nflink-reactor failed to start: ${err.message}\r\n`,
        )
        liveProcesses.delete(identity)
        closeEmitter.fire(1)
      })
      child.on("close", (code) => {
        if (pending.trim().length > 0) {
          const parsed = parseProblemLine(pending)
          if (parsed) problems.push(parsed)
        }
        applyProblems(projectDir, problems)
        liveProcesses.delete(identity)
        closeEmitter.fire(code ?? 0)
      })
      liveProcesses.set(identity, () => child?.kill())
    },
    // User cancel / terminate / panel close → kill the child; its `close`
    // event finishes the bookkeeping and ends the task with the exit code.
    close: () => {
      child?.kill()
    },
  }
}

/** Land parsed CLI problems in the Problems panel, grouped per file, under
 *  the CLI's own source (§2: navigable, never duplicating the LSP's). */
function applyProblems(
  projectDir: string,
  problems: readonly ParsedProblem[],
): void {
  const byFile = new Map<string, vscode.Diagnostic[]>()
  for (const p of problems) {
    const fsPath = isAbsolute(p.file) ? p.file : join(projectDir, p.file)
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        Math.max(0, p.line - 1),
        Math.max(0, p.column - 1),
        Math.max(0, p.line - 1),
        Number.MAX_SAFE_INTEGER,
      ),
      p.message,
      p.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    )
    diagnostic.source = CLI_DIAGNOSTIC_SOURCE
    diagnostic.code = p.code
    const list = byFile.get(fsPath) ?? []
    list.push(diagnostic)
    byFile.set(fsPath, list)
  }
  for (const [fsPath, list] of byFile) {
    diagnostics().set(vscode.Uri.file(fsPath), list)
  }
}

// ── Task construction + execution ───────────────────────────────────

/** Build the `vscode.Task` for a descriptor against a resolved binary. */
export function createLifecycleTask(
  descriptor: CommandDescriptor,
  binaryPath: string,
  projectDir: string,
  workspaceFolder: vscode.WorkspaceFolder | undefined,
): vscode.Task {
  const definition: FlinkReactorTaskDefinition = {
    type: FLINK_REACTOR_TASK_TYPE,
    verb: descriptor.verb,
    ...(descriptor.pipeline ? { pipeline: descriptor.pipeline } : {}),
    ...(descriptor.env ? { env: descriptor.env } : {}),
    ...(descriptor.flags?.length ? { flags: descriptor.flags } : {}),
  }
  const task = new vscode.Task(
    definition,
    workspaceFolder ?? vscode.TaskScope.Workspace,
    taskLabel(descriptor),
    FLINK_REACTOR_TASK_TYPE,
    new vscode.CustomExecution(async () =>
      createPty(descriptor, binaryPath, projectDir),
    ),
  )
  // `fr dev` is a long-running watch; everything else is a one-shot run.
  task.isBackground = descriptor.verb === "dev"
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    echo: true,
    panel: vscode.TaskPanelKind.Dedicated, // stable per task identity (7.3)
    showReuseMessage: false,
  }
  return task
}

/** One terminal per verb+pipeline+env: the task NAME carries the identity, so
 *  VS Code's dedicated-panel reuse keys on it. */
function taskLabel(descriptor: CommandDescriptor): string {
  return descriptorIdentity(descriptor)
    .split("|")
    .filter((part) => part.length > 0)
    .join(" · ")
}

export interface RunOutcome {
  readonly started: boolean
  readonly execution?: vscode.TaskExecution
  readonly error?: string
}

/** One `vscode.Task` INSTANCE per (identity, binary, projectDir) — task 7.3's
 *  "stable task per command" made literal: re-running reuses the instance and
 *  its dedicated terminal instead of stacking new ones. */
const taskCache = new Map<string, { binary: string; task: vscode.Task }>()

/**
 * Resolve the binary, build (or reuse) the task, and execute it. Returns
 * without spawning anything when the binary cannot be resolved (task 1.4) —
 * the actionable message is shown and logged.
 */
export async function runLifecycleTask(
  descriptor: CommandDescriptor,
  projectDir: string,
): Promise<RunOutcome> {
  const resolved = resolveCliBinary({
    projectDir,
    cliPathSetting: cliPathSetting(),
  })
  if (resolved.kind === "not-found") {
    getOutputChannel().error(resolved.message)
    void vscode.window.showErrorMessage(`FlinkReactor: ${resolved.message}`)
    return { started: false, error: resolved.message }
  }
  const folder = vscode.workspace.workspaceFolders?.find((f) =>
    projectDir.startsWith(f.uri.fsPath),
  )
  const key = `${projectDir}::${descriptorIdentity(descriptor)}::${JSON.stringify(descriptor.flags ?? [])}`
  const cached = taskCache.get(key)
  let task: vscode.Task
  if (cached && cached.binary === resolved.path) {
    task = cached.task
  } else {
    task = createLifecycleTask(descriptor, resolved.path, projectDir, folder)
    taskCache.set(key, { binary: resolved.path, task })
  }
  getOutputChannel().info(
    `Running: flink-reactor ${buildArgs(descriptor).join(" ")} (${resolved.source} binary, cwd ${projectDir})`,
  )
  const execution = await vscode.tasks.executeTask(task)
  return { started: true, execution }
}

/**
 * Surface non-zero exits (task 7.2): one listener for ALL flink-reactor
 * tasks reports the failing command + exit code via a notification and the
 * output channel. Returns the disposable for the extension's subscriptions.
 */
export function registerExitReporter(): vscode.Disposable {
  return vscode.tasks.onDidEndTaskProcess((event) => {
    const definition = event.execution.task.definition
    if (definition.type !== FLINK_REACTOR_TASK_TYPE) return
    const verb = String(definition.verb ?? "command")
    if (event.exitCode === undefined || event.exitCode === 0) {
      getOutputChannel().info(`flink-reactor ${verb} completed`)
      return
    }
    const message = `flink-reactor ${verb} failed (exit code ${event.exitCode})`
    getOutputChannel().error(message)
    void vscode.window.showErrorMessage(`FlinkReactor: ${message}`)
  })
}

/**
 * The contributed `TaskProvider`: offers one parameterless task per verb in
 * the Tasks UI and resolves `tasks.json` entries by rebuilding the execution
 * from the definition (verb/pipeline/env/flags).
 */
export class FlinkReactorTaskProvider implements vscode.TaskProvider {
  constructor(private readonly getProjectDir: () => string | undefined) {}

  provideTasks(): vscode.Task[] {
    const projectDir = this.getProjectDir()
    if (!projectDir) return []
    const resolved = resolveCliBinary({
      projectDir,
      cliPathSetting: cliPathSetting(),
    })
    if (resolved.kind === "not-found") return []
    const folder = vscode.workspace.workspaceFolders?.find((f) =>
      projectDir.startsWith(f.uri.fsPath),
    )
    return LIFECYCLE_VERBS.map((verb) =>
      createLifecycleTask({ verb }, resolved.path, projectDir, folder),
    )
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const projectDir = this.getProjectDir()
    if (!projectDir) return undefined
    const definition = task.definition as FlinkReactorTaskDefinition
    if (definition.type !== FLINK_REACTOR_TASK_TYPE || !definition.verb) {
      return undefined
    }
    if (!LIFECYCLE_VERBS.includes(definition.verb as never)) return undefined
    const resolved = resolveCliBinary({
      projectDir,
      cliPathSetting: cliPathSetting(),
    })
    if (resolved.kind === "not-found") return undefined
    const descriptor: CommandDescriptor = {
      verb: definition.verb as CommandDescriptor["verb"],
      ...(definition.pipeline ? { pipeline: definition.pipeline } : {}),
      ...(definition.env ? { env: definition.env } : {}),
      ...(definition.flags ? { flags: definition.flags } : {}),
    }
    const folder = vscode.workspace.workspaceFolders?.find((f) =>
      projectDir.startsWith(f.uri.fsPath),
    )
    // `resolveTask` must reuse the ORIGINAL task's definition object —
    // returning a task with a fresh definition is rejected by VS Code.
    const built = createLifecycleTask(
      descriptor,
      resolved.path,
      projectDir,
      folder,
    )
    return new vscode.Task(
      task.definition,
      task.scope ?? vscode.TaskScope.Workspace,
      task.name,
      FLINK_REACTOR_TASK_TYPE,
      built.execution,
    )
  }
}
