// The thin `vscode`-facing applier for the embedded-SQL highlighting opt-out
// (task 4.2). It reads `flinkReactor.sql.highlighting` + the active theme,
// computes the neutralization rules (`highlighting-rules.ts`, pure/tested), and
// writes them into the workspace `editor.tokenColorCustomizations` when — and
// only when — they change. The default mode (`semantic+textmate`) neutralizes
// nothing, so a fresh install never mutates user config; a write happens only
// after the user explicitly chooses `semantic`/`off`, and is reverted when they
// switch back.

import * as vscode from "vscode"
import { nextTextMateRules, type TextMateRule } from "./highlighting-rules.js"

const TOKEN_CUSTOMIZATIONS = "tokenColorCustomizations"

/** Owns the `editor.tokenColorCustomizations` neutralization for FR SQL. */
export class SqlHighlightingController {
  private readonly disposables: vscode.Disposable[] = []

  /** Apply the current setting now and re-apply on setting / theme changes.
   *  Returns a disposable that tears the subscriptions down. */
  register(): vscode.Disposable {
    this.sync()
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("flinkReactor.sql.highlighting")) this.sync()
      }),
      // The neutralization color depends on theme brightness; re-sync on switch.
      vscode.window.onDidChangeActiveColorTheme(() => this.sync()),
    )
    return { dispose: () => this.dispose() }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.disposables.length = 0
  }

  private sync(): void {
    // Neutralization writes to the *workspace* token customizations; without a
    // workspace folder there is no workspace target to write to, so skip (the
    // semantic-layer opt-out, handled server-side, still applies).
    if (!vscode.workspace.workspaceFolders?.length) return

    const mode = vscode.workspace
      .getConfiguration("flinkReactor")
      .get<string>("sql.highlighting", "semantic+textmate")
    const isLight = isLightTheme(vscode.window.activeColorTheme.kind)

    const editorCfg = vscode.workspace.getConfiguration("editor")
    const current =
      editorCfg.get<{ textMateRules?: TextMateRule[] }>(TOKEN_CUSTOMIZATIONS) ??
      {}
    const next = nextTextMateRules(current.textMateRules ?? [], mode, isLight)
    if (next === null) return // unchanged — avoid config churn

    void editorCfg.update(
      TOKEN_CUSTOMIZATIONS,
      { ...current, textMateRules: next },
      vscode.ConfigurationTarget.Workspace,
    )
  }
}

function isLightTheme(kind: vscode.ColorThemeKind): boolean {
  return (
    kind === vscode.ColorThemeKind.Light ||
    kind === vscode.ColorThemeKind.HighContrastLight
  )
}
