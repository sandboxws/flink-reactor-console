// `flink-reactor` binary resolution (cli-lifecycle-integration, task 1.1).
//
// Order: workspace `node_modules/.bin/flink-reactor` (the version-pinned dev
// dependency a FlinkReactor project declares) → the explicit
// `flinkReactor.cliPath` setting → `PATH`. Resolution NEVER silently no-ops:
// when nothing resolves, the caller gets a structured not-found result with
// an actionable message (install the CLI or set `flinkReactor.cliPath`) and
// must not spawn a process (task 1.4).
//
// Pure (fs + injected env) so it is unit-testable without VS Code.

import { existsSync } from "node:fs"
import { delimiter, join } from "node:path"

export type ResolvedBinary =
  | {
      readonly kind: "found"
      readonly path: string
      readonly source: "workspace" | "setting" | "PATH"
    }
  | { readonly kind: "not-found"; readonly message: string }

const BIN_NAME =
  process.platform === "win32" ? "flink-reactor.cmd" : "flink-reactor"

export interface ResolveBinaryInput {
  /** The FlinkReactor project root (where `node_modules` lives). */
  readonly projectDir: string
  /** The `flinkReactor.cliPath` setting ("" when unset). */
  readonly cliPathSetting: string
  /** `process.env.PATH` (injectable for tests). */
  readonly pathEnv?: string
}

export function resolveCliBinary(input: ResolveBinaryInput): ResolvedBinary {
  // 1. The workspace dev-dependency binary always wins — it is the
  //    version-matched CLI the project pins.
  const workspaceBin = join(input.projectDir, "node_modules", ".bin", BIN_NAME)
  if (existsSync(workspaceBin)) {
    return { kind: "found", path: workspaceBin, source: "workspace" }
  }

  // 2. The explicit override for non-standard installs.
  const setting = input.cliPathSetting.trim()
  if (setting.length > 0 && existsSync(setting)) {
    return { kind: "found", path: setting, source: "setting" }
  }

  // 3. Last resort: a global install on PATH.
  const pathEnv = input.pathEnv ?? process.env.PATH ?? ""
  for (const dir of pathEnv.split(delimiter)) {
    if (dir.length === 0) continue
    const candidate = join(dir, BIN_NAME)
    if (existsSync(candidate)) {
      return { kind: "found", path: candidate, source: "PATH" }
    }
  }

  return {
    kind: "not-found",
    message:
      "The `flink-reactor` CLI was not found. Install it in the workspace " +
      "(`pnpm add -D @flink-reactor/dsl`) or point the `flinkReactor.cliPath` " +
      "setting at the binary.",
  }
}
