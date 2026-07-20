import * as vscode from "vscode"

let channel: vscode.LogOutputChannel | undefined

/**
 * The shared `FlinkReactor` output channel. A `LogOutputChannel` (VS Code 1.74+)
 * gives us leveled `info`/`warn`/`error` logging with timestamps for free, and
 * doubles as the `vscode-languageclient` output sink so server logs land here too.
 */
export function getOutputChannel(): vscode.LogOutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("FlinkReactor", { log: true })
  }
  return channel
}

export function disposeOutputChannel(): void {
  channel?.dispose()
  channel = undefined
}
