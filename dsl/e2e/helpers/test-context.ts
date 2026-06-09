// ── Black-box TestContext ────────────────────────────────────────────
// Every project lives in its own mkdtemp dir (full isolation, parallel-
// safe), runs the REAL packaged CLI as a subprocess, and cleans up after
// itself unless FR_E2E_KEEP=1.
//
// Hard rule for this directory: no imports from `src/**` or
// `@flink-reactor/*` workspace code — the vitest config has no `@` alias
// on purpose, so such imports fail loudly. The only inputs are the
// packed artifact and the filesystem.

import { execFileSync, spawn } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { inject } from "vitest"
import { parse as parseYaml } from "yaml"

export interface RunResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface RunOptions {
  readonly env?: Record<string, string>
  readonly timeoutMs?: number
  /** Working directory override (defaults to the project dir). */
  readonly cwd?: string
}

export interface E2eProject {
  readonly name: string
  readonly dir: string
  /** Spawn the CLI with cwd = project dir. Never throws on non-zero exit. */
  run(args: readonly string[], opts?: RunOptions): Promise<RunResult>
  synth(extraArgs?: readonly string[]): Promise<RunResult>
  validate(extraArgs?: readonly string[]): Promise<RunResult>
  graph(format: "ascii" | "dot"): Promise<RunResult>
  /** Run a command with `--json` and parse the stdout envelope. */
  runJson(
    args: readonly string[],
  ): Promise<{ result: RunResult; envelope: JsonEnvelope }>
  writeFile(relPath: string, content: string): void
  readFile(relPath: string): string
  readYaml<T = unknown>(relPath: string): T
  readJson<T = unknown>(relPath: string): T
  /** relPath → content for every file under <dir>/<outdir>, sorted. */
  snapshotOutdir(outdir?: string): Map<string, string>
}

/** Loose envelope shape — schema details are asserted in tests. */
export interface JsonEnvelope {
  readonly formatVersion: number
  readonly tool: { readonly name: string; readonly version: string }
  readonly command: string
  readonly ok: boolean
  readonly pipelines: readonly Record<string, unknown>[]
  readonly warnings: readonly string[]
  readonly error?: Record<string, unknown>
  readonly [key: string]: unknown
}

export interface E2eContext {
  /** CLI entry used for scaffolding (tarball install with deps). */
  readonly toolCli: string
  /** The packed tarball every project installs. */
  readonly tarball: string
  /**
   * Scaffold a template into an isolated temp dir via the real
   * `flink-reactor new`, rewrite the dsl dependency to the packed
   * tarball, and (unless `install: false`) `pnpm install --prod`.
   */
  scaffold(
    template: string,
    opts?: { name?: string; install?: boolean },
  ): Promise<E2eProject>
  /** An empty isolated dir with CLI helpers — no scaffold, no install. */
  emptyProject(): E2eProject
  /** Remove every temp dir this context created (FR_E2E_KEEP=1 skips). */
  cleanupAll(): void
}

const DSL_PACKAGE = "@flink-reactor/dsl"

function spawnNode(
  entry: string,
  args: readonly string[],
  cwd: string,
  opts?: RunOptions,
): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: opts?.cwd ?? cwd,
      env: {
        ...stripColorVars(process.env),
        NO_COLOR: "1",
        CI: "1",
        ...opts?.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8")
    })

    const timeoutMs = opts?.timeoutMs ?? 60_000
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
    }, timeoutMs)

    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: code ?? 1, stdout, stderr })
    })
  })
}

function stripColorVars(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (key === "FORCE_COLOR" || value === undefined) continue
    out[key] = value
  }
  return out
}

function runPnpm(args: readonly string[], cwd: string): void {
  // pnpm itself, not the CLI under test — synchronous is fine here.
  execFileSync("pnpm", args, { cwd, stdio: "pipe" })
}

function walkFiles(root: string, dir: string, out: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkFiles(root, full, out)
    } else {
      out.set(relative(root, full), readFileSync(full, "utf-8"))
    }
  }
}

/** Find the CLI entry inside a project's own node_modules, if installed. */
function projectCli(dir: string): string | null {
  const candidate = join(
    dir,
    "node_modules",
    ...DSL_PACKAGE.split("/"),
    "dist",
    "cli.js",
  )
  try {
    statSync(candidate)
    return candidate
  } catch {
    return null
  }
}

export function createE2eContext(): E2eContext {
  const toolCli = inject("frE2eCli")
  const tarball = inject("frE2eTarball")
  const keep = process.env.FR_E2E_KEEP === "1"
  const tempDirs: string[] = []

  function makeProject(name: string, dir: string): E2eProject {
    const cli = (): string => projectCli(dir) ?? toolCli

    const run = (
      args: readonly string[],
      opts?: RunOptions,
    ): Promise<RunResult> => spawnNode(cli(), args, dir, opts)

    return {
      name,
      dir,
      run,
      synth: (extra = []) => run(["synth", ...extra]),
      validate: (extra = []) => run(["validate", ...extra]),
      graph: (format) => run(["graph", "-f", format]),
      runJson: async (args) => {
        const result = await run([...args, "--json"])
        let envelope: JsonEnvelope
        try {
          envelope = JSON.parse(result.stdout) as JsonEnvelope
        } catch (err) {
          throw new Error(
            `--json stdout is not valid JSON (exit ${result.exitCode}):\n${result.stdout}\nstderr:\n${result.stderr}\n${String(err)}`,
          )
        }
        return { result, envelope }
      },
      writeFile: (relPath, content) => {
        const full = join(dir, relPath)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, content, "utf-8")
      },
      readFile: (relPath) => readFileSync(join(dir, relPath), "utf-8"),
      readYaml: <T>(relPath: string): T =>
        parseYaml(readFileSync(join(dir, relPath), "utf-8")) as T,
      readJson: <T>(relPath: string): T =>
        JSON.parse(readFileSync(join(dir, relPath), "utf-8")) as T,
      snapshotOutdir: (outdir = "dist") => {
        const out = new Map<string, string>()
        const root = join(dir, outdir)
        walkFiles(root, root, out)
        return new Map(
          [...out.entries()].sort(([a], [b]) => a.localeCompare(b)),
        )
      },
    }
  }

  return {
    toolCli,
    tarball,
    async scaffold(template, opts) {
      const name = opts?.name ?? `app-${template}`
      const parent = mkdtempSync(join(tmpdir(), "fr-e2e-"))
      tempDirs.push(parent)

      const scaffoldResult = await spawnNode(
        toolCli,
        [
          "new",
          name,
          "-t",
          template,
          "--pm",
          "pnpm",
          "--yes",
          "--no-git",
          "--no-install",
          "--no-grafana",
        ],
        parent,
        { timeoutMs: 120_000 },
      )
      if (scaffoldResult.exitCode !== 0) {
        throw new Error(
          `scaffold ${template} failed (exit ${scaffoldResult.exitCode}):\n${scaffoldResult.stdout}\n${scaffoldResult.stderr}`,
        )
      }

      const dir = join(parent, name)
      const project = makeProject(name, dir)

      // Point every workspace package.json at the packed tarball, then
      // install for real — bin shims, exports map, vendored deps and all.
      rewriteDslDependency(dir, tarball)
      if (opts?.install !== false) {
        runPnpm(["install", "--prod", "--prefer-offline"], dir)
      }

      return project
    },
    emptyProject() {
      const dir = mkdtempSync(join(tmpdir(), "fr-e2e-empty-"))
      tempDirs.push(dir)
      return makeProject("empty", dir)
    },
    cleanupAll() {
      if (keep) {
        for (const dir of tempDirs) {
          process.stdout.write(`[fr-e2e] keep: ${dir}\n`)
        }
        return
      }
      for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
}

/**
 * Replace every `@flink-reactor/dsl` dependency declaration under the
 * project (root + workspace packages) with `file:<tarball>`.
 */
function rewriteDslDependency(projectDir: string, tarball: string): void {
  const queue: string[] = [projectDir]
  while (queue.length > 0) {
    const dir = queue.pop() as string
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        queue.push(full)
      } else if (entry === "package.json") {
        const pkg = JSON.parse(readFileSync(full, "utf-8")) as {
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
        }
        let changed = false
        for (const section of [pkg.dependencies, pkg.devDependencies]) {
          if (section?.[DSL_PACKAGE]) {
            section[DSL_PACKAGE] = `file:${tarball}`
            changed = true
          }
        }
        if (changed) {
          writeFileSync(full, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8")
        }
      }
    }
  }
}
