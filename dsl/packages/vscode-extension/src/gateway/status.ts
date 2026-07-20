// Gateway-state status bar item (gateway-validation, Tier-3 feature 11).
//
// A small, dedicated status item — separate from the language-server status —
// that renders the server's `flinkReactor/gatewayState` notifications. Shown
// only while `flinkReactor.gateway.enabled` is on, so the opt-out majority
// never sees gateway chrome. Work-done progress for an in-flight pass is
// rendered by `vscode-languageclient` automatically; this item carries the
// steady state (idle/validating/error).

import * as vscode from "vscode"
import type { GatewayState } from "./protocol.js"

const STATES: Record<GatewayState, { text: string; tooltip: string }> = {
  disabled: { text: "", tooltip: "" },
  idle: {
    text: "$(beaker) Gateway",
    tooltip: "FlinkReactor deep validation: gateway ready",
  },
  validating: {
    text: "$(sync~spin) Gateway",
    tooltip: "FlinkReactor deep validation: pass in flight…",
  },
  error: {
    text: "$(warning) Gateway",
    tooltip: "FlinkReactor deep validation: gateway unavailable",
  },
}

export class GatewayStatusItem {
  private readonly item: vscode.StatusBarItem

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      "flinkReactor.gatewayState",
      vscode.StatusBarAlignment.Left,
      99,
    )
    this.item.name = "FlinkReactor Gateway"
    this.item.command = "flinkReactor.deepValidate"
    this.sync()
  }

  /** Apply a server-pushed state. */
  update(state: GatewayState, message?: string): void {
    if (state === "disabled" || !this.enabled()) {
      this.item.hide()
      return
    }
    const view = STATES[state]
    this.item.text = view.text
    this.item.tooltip = message ? `${view.tooltip} — ${message}` : view.tooltip
    this.item.backgroundColor =
      state === "error"
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined
    this.item.show()
  }

  /** Re-evaluate visibility after a settings change. */
  sync(): void {
    if (this.enabled()) this.update("idle")
    else this.item.hide()
  }

  dispose(): void {
    this.item.dispose()
  }

  private enabled(): boolean {
    return vscode.workspace
      .getConfiguration("flinkReactor")
      .get<boolean>("gateway.enabled", false)
  }
}
