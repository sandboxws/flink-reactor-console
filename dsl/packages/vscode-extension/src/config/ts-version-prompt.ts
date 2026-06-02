import { existsSync } from "node:fs"
import { join } from "node:path"

export interface TsVersionState {
  /** The project has its own `node_modules/typescript` install. */
  readonly workspaceTypeScriptPresent: boolean
  /** `typescript.tsdk` is already set (so VS Code is NOT on its bundled TS). */
  readonly tsdkConfigured: boolean
  /** The user previously dismissed the prompt for this workspace. */
  readonly dismissed: boolean
}

/**
 * Whether the project ships its own TypeScript (`fs`-only, testable). When it
 * does, that copy carries the ts-plugin's peer and can host it — but only once
 * VS Code is switched onto it.
 */
export function hasWorkspaceTypeScript(projectDir: string): boolean {
  return existsSync(
    join(projectDir, "node_modules", "typescript", "lib", "tsserver.js"),
  )
}

/**
 * Decide whether to show the "Use Workspace TypeScript Version" prompt: the
 * project has its own TypeScript, VS Code is still on its bundled TS
 * (`typescript.tsdk` unset), and the user has not dismissed the prompt here.
 * Pure, so it is unit-testable without `vscode`.
 */
export function shouldPromptForWorkspaceTs(state: TsVersionState): boolean {
  return (
    state.workspaceTypeScriptPresent &&
    !state.tsdkConfigured &&
    !state.dismissed
  )
}
