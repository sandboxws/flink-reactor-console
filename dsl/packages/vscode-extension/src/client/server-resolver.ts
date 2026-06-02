import { existsSync } from "node:fs"
import { join } from "node:path"

export interface ResolvedServer {
  /** Absolute path to the server's stdio entry (`bin/flink-reactor-lsp.mjs`). */
  readonly modulePath: string
  /** Where the binary was found. */
  readonly source: "workspace" | "bundled"
}

const WORKSPACE_BIN = join(
  "node_modules",
  "@flink-reactor",
  "language-server",
  "bin",
  "flink-reactor-lsp.mjs",
)
const BUNDLED_BIN = join("server", "bin", "flink-reactor-lsp.mjs")

/**
 * Resolve the language-server stdio entry. Prefers the project's own install so
 * the server matches the DSL version the project depends on (keeping editor
 * diagnostics in lockstep with `flink-reactor synth`); falls back to the copy
 * bundled in the extension under `server/`. Pure (`fs`-only) for unit testing.
 */
export function resolveServerModule(
  projectDir: string,
  extensionPath: string,
): ResolvedServer | null {
  const workspaceBin = join(projectDir, WORKSPACE_BIN)
  if (existsSync(workspaceBin)) {
    return { modulePath: workspaceBin, source: "workspace" }
  }
  const bundledBin = join(extensionPath, BUNDLED_BIN)
  if (existsSync(bundledBin)) {
    return { modulePath: bundledBin, source: "bundled" }
  }
  return null
}
