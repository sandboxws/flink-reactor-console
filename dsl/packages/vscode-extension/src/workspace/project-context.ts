import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parse as parseJsonc } from "jsonc-parser"

/**
 * The FlinkReactor project rooted at the nearest `flink-reactor.config.ts`.
 * Pure (no `vscode` dependency) so it is unit-testable and reusable by other
 * features that plug into the shell.
 */
export interface ProjectContext {
  /** Absolute directory containing `flink-reactor.config.ts`. */
  readonly projectDir: string
  /** Absolute directory the `@/` alias points at (`projectDir` or `projectDir/src`). */
  readonly aliasTarget: string
  /** Absolute path to the project `tsconfig.json`, or `null` if absent. */
  readonly tsconfigPath: string | null
}

const CONFIG_FILE = "flink-reactor.config.ts"

/**
 * Walk up from `startDir` to the filesystem root, returning the first directory
 * that contains a `flink-reactor.config.ts`, or `null` if none is found.
 */
export function findProjectDir(startDir: string): string | null {
  let dir = resolve(startDir)
  // Bounded by the filesystem root: `dirname("/") === "/"`.
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Resolve the `@/` path alias from a tsconfig's `compilerOptions.paths`.
 *
 *   "@/*": ["./*"]      → projectDir
 *   "@/*": ["./src/*"]  → projectDir/src
 *
 * Falls back to `projectDir` when the tsconfig or the `@/*` mapping is absent or
 * unparseable. Mirrors the convention in `@flink-reactor/dsl` `src/cli/discovery.ts`,
 * parsed with `jsonc-parser` so comments and trailing commas are tolerated.
 */
export function resolveAliasTarget(
  projectDir: string,
  tsconfigPath: string | null,
): string {
  if (!tsconfigPath || !existsSync(tsconfigPath)) return projectDir
  try {
    const tsconfig = parseJsonc(readFileSync(tsconfigPath, "utf-8")) as
      | { compilerOptions?: { paths?: Record<string, string[]> } }
      | undefined
    const target = tsconfig?.compilerOptions?.paths?.["@/*"]?.[0]
    if (!target) return projectDir
    // "./*" → ".", "./src/*" → "./src"
    const mapping = target.replace(/\/?\*$/, "")
    return resolve(projectDir, mapping)
  } catch {
    return projectDir
  }
}

/**
 * Build the full project context rooted at the nearest config above `startDir`.
 * Returns `null` when `startDir` is not inside a FlinkReactor project.
 */
export function resolveProjectContext(startDir: string): ProjectContext | null {
  const projectDir = findProjectDir(startDir)
  if (!projectDir) return null
  const candidate = join(projectDir, "tsconfig.json")
  const tsconfigPath = existsSync(candidate) ? candidate : null
  return {
    projectDir,
    aliasTarget: resolveAliasTarget(projectDir, tsconfigPath),
    tsconfigPath,
  }
}
