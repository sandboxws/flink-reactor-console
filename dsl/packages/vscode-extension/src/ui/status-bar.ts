import * as vscode from "vscode"

export type ServerStatus = "starting" | "running" | "stopped" | "error"

interface Presentation {
  readonly icon: string
  readonly tooltip: string
}

const PRESENTATION: Record<ServerStatus, Presentation> = {
  starting: {
    icon: "sync~spin",
    tooltip: "FlinkReactor language server starting…",
  },
  running: { icon: "zap", tooltip: "FlinkReactor language server running" },
  stopped: {
    icon: "circle-slash",
    tooltip: "FlinkReactor language server stopped",
  },
  error: {
    icon: "error",
    tooltip: "FlinkReactor language server error — click to view logs",
  },
}

/**
 * Status bar item reflecting language-server health. The active-environment
 * label is a placeholder slot until `cli-lifecycle-integration` (Tier 3) owns
 * environment switching; pass `environment` to surface it early.
 */
export class StatusBar {
  private readonly item: vscode.StatusBarItem

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    )
    this.item.command = "flinkReactor.showOutput"
    this.set("stopped")
    this.item.show()
  }

  set(status: ServerStatus, environment?: string): void {
    const { icon, tooltip } = PRESENTATION[status]
    const label = environment ? `FlinkReactor · ${environment}` : "FlinkReactor"
    this.item.text = `$(${icon}) ${label}`
    this.item.tooltip = tooltip
  }

  dispose(): void {
    this.item.dispose()
  }
}
