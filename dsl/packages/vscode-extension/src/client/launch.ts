import * as vscode from "vscode"
import {
  CloseAction,
  type CloseHandlerResult,
  DidChangeConfigurationNotification,
  ErrorAction,
  type ErrorHandler,
  type ErrorHandlerResult,
  LanguageClient,
  type LanguageClientOptions,
  RevealOutputChannelOn,
  type ServerOptions,
  State,
  TransportKind,
} from "vscode-languageclient/node"
import {
  SYNTHESIZED_NOTIFICATION,
  type SynthesizedNotification,
} from "../graph/protocol.js"
import { getOutputChannel } from "../ui/output.js"
import type { StatusBar } from "../ui/status-bar.js"
import type { ProjectContext } from "../workspace/project-context.js"
import { decideRestart } from "./restart-policy.js"
import { resolveServerModule } from "./server-resolver.js"

/** The flat settings object the language server's `parseConfig` consumes. */
interface ServerSettings {
  readonly enable: boolean
  readonly debounce: number
  readonly timeout: number
  readonly maxHeapMb: number
  readonly flinkVersion?: string
}

/** Map VS Code's nested `flinkReactor.*` config into the server's flat shape. */
function readServerSettings(): ServerSettings {
  const cfg = vscode.workspace.getConfiguration("flinkReactor")
  return {
    // The server publishes diagnostics only when both switches are on.
    enable:
      cfg.get<boolean>("enable", true) &&
      cfg.get<boolean>("diagnostics.enable", true),
    debounce: cfg.get<number>("server.debounce", 300),
    timeout: cfg.get<number>("server.timeout", 5000),
    maxHeapMb: cfg.get<number>("server.maxHeapMb", 512),
    flinkVersion: cfg.get<string>("flinkVersion") || undefined,
  }
}

/**
 * Owns the FlinkReactor language-server connection for one project: resolves the
 * server binary, starts a stdio `vscode-languageclient`, reflects lifecycle into
 * the status bar, forwards settings, and applies the crash-restart policy.
 */
export class FlinkReactorClient {
  private client: LanguageClient | undefined
  private readonly crashes: number[] = []
  /** Set when the user/extension stopped the server deliberately. */
  private stopping = false

  /** Fires after each debounced re-synthesis (the `flinkReactor/synthesized`
   *  notification) so an open DAG panel can pull a fresh model. Re-wired on
   *  every (re)start so it survives server restarts. */
  private readonly synthesizedEmitter =
    new vscode.EventEmitter<SynthesizedNotification>()
  readonly onSynthesized = this.synthesizedEmitter.event

  constructor(
    private readonly project: ProjectContext,
    private readonly extensionPath: string,
    private readonly status: StatusBar,
  ) {}

  async start(): Promise<void> {
    const log = getOutputChannel()
    const resolved = resolveServerModule(
      this.project.projectDir,
      this.extensionPath,
    )
    if (!resolved) {
      log.error(
        "Could not locate @flink-reactor/language-server (neither the workspace install nor the bundled copy).",
      )
      this.status.set("error")
      return
    }
    log.info(
      `Language server resolved (${resolved.source}): ${resolved.modulePath}`,
    )

    const module = resolved.modulePath
    const serverOptions: ServerOptions = {
      run: { module, transport: TransportKind.stdio },
      debug: { module, transport: TransportKind.stdio },
    }
    // Scope to TSX files under this project so a multi-root workspace runs one
    // server per FlinkReactor project rather than one global server. The LSP
    // `DocumentFilter.pattern` is a glob string (matched against the file path),
    // so build an absolute posix glob from the project directory.
    const tsxGlob = `${this.project.projectDir.split(/[\\/]/).join("/")}/**/*.tsx`
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { language: "typescriptreact", scheme: "file", pattern: tsxGlob },
      ],
      initializationOptions: { flinkReactor: readServerSettings() },
      outputChannel: log,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      errorHandler: this.createErrorHandler(),
    }

    this.client = new LanguageClient(
      "flinkReactor",
      "FlinkReactor Language Server",
      serverOptions,
      clientOptions,
    )
    // Drive the status bar straight off the client's lifecycle so restarts and
    // crashes stay reflected without manual bookkeeping.
    this.client.onDidChangeState((e) => {
      if (e.newState === State.Starting) this.status.set("starting")
      else if (e.newState === State.Running) this.status.set("running")
      else this.status.set(this.stopping ? "stopped" : "error")
    })

    try {
      await this.client.start()
      // Bridge the server's re-synthesis signal onto our public event. Safe to
      // register after start; persists for the life of this client instance
      // (including its own crash-restarts).
      this.client.onNotification(
        SYNTHESIZED_NOTIFICATION,
        (params: SynthesizedNotification) =>
          this.synthesizedEmitter.fire(params),
      )
      log.info("Language server started.")
    } catch (err) {
      this.status.set("error")
      log.error(`Language server failed to start: ${String(err)}`)
    }
  }

  /**
   * Send a custom LSP request to the running server, or resolve `undefined`
   * when no server is running (so callers degrade rather than throw). Used by
   * the DAG panel for `flinkReactor/graphModel` and `flinkReactor/nodeRange`.
   */
  async sendGraphRequest<T>(
    method: string,
    params: unknown,
  ): Promise<T | undefined> {
    if (!this.client || this.client.state !== State.Running) return undefined
    try {
      return await this.client.sendRequest<T>(method, params)
    } catch (err) {
      getOutputChannel().warn(`${method} request failed: ${String(err)}`)
      return undefined
    }
  }

  /** Forward `flinkReactor.*` setting changes to the running server. */
  watchConfiguration(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("flinkReactor")) return
      void this.client?.sendNotification(
        DidChangeConfigurationNotification.type,
        { settings: { flinkReactor: readServerSettings() } },
      )
    })
  }

  async restart(): Promise<void> {
    const log = getOutputChannel()
    this.crashes.length = 0
    this.stopping = false
    if (this.client) {
      log.info("Restarting language server…")
      await this.client.restart()
    } else {
      await this.start()
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.client) {
      await this.client.stop().catch(() => undefined)
      this.client = undefined
    }
    this.status.set("stopped")
  }

  async dispose(): Promise<void> {
    this.synthesizedEmitter.dispose()
    await this.stop()
  }

  private createErrorHandler(): ErrorHandler {
    const log = getOutputChannel()
    return {
      error: (error, _message, count): ErrorHandlerResult => {
        log.error(`Language server error (#${count ?? "?"}): ${error.message}`)
        // Transient RPC errors keep the connection; `closed` governs restarts.
        return { action: ErrorAction.Continue }
      },
      closed: async (): Promise<CloseHandlerResult> => {
        const now = Date.now()
        this.crashes.push(now)
        const decision = decideRestart(this.crashes, now)
        log.warn(`Language server exited — ${decision.reason}`)
        if (decision.action === "stop") {
          void vscode.window
            .showErrorMessage(
              `FlinkReactor language server keeps crashing (${decision.reason}).`,
              "Show Logs",
            )
            .then((pick) => {
              if (pick) log.show()
            })
          return { action: CloseAction.DoNotRestart }
        }
        if (decision.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, decision.delayMs))
        }
        return { action: CloseAction.Restart }
      },
    }
  }
}
