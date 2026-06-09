// ── E2E global setup: build → pack → install the real artifact ──────
// The whole suite runs against the PACKED tarball, never repo `src/`:
// the `files` field, `exports` map, bin shim, bundled templates, and
// vendored deps only exist in the published artifact — the bug classes
// this suite exists to catch (missing vendored deps, broken bin
// resolution, version-injection failures) are invisible to in-process
// tests.
//
// Env knobs:
//   FR_E2E_SKIP_BUILD=1  reuse the existing dist/ (CI builds first)
//   FR_E2E_BIN=<path>    use a prebuilt CLI entry instead of the
//                        tarball-installed one (scaffolding only;
//                        per-project runs still use the project's own
//                        installed copy)
//   FR_E2E_KEEP=1        keep temp dirs for debugging (paths printed)

import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { TestProject } from "vitest/node"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

declare module "vitest" {
  interface ProvidedContext {
    /** Absolute path of the packed `@flink-reactor/dsl` tarball. */
    frE2eTarball: string
    /** CLI entry (dist/cli.js) of a tarball install with dependencies —
     *  used to scaffold projects before they have node_modules. */
    frE2eCli: string
  }
}

function sh(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: "pipe" })
}

// biome-ignore lint/style/noDefaultExport: vitest globalSetup requires a default export
export default async function setup(project: TestProject): Promise<() => void> {
  const keep = process.env.FR_E2E_KEEP === "1"
  const stamp = (label: string, value: string): void => {
    process.stdout.write(`[fr-e2e] ${label}: ${value}\n`)
  }

  // 1. Build the publishable artifact (skippable when CI already built).
  if (process.env.FR_E2E_SKIP_BUILD !== "1") {
    stamp("build", "pnpm build")
    sh("pnpm", ["build"], repoRoot)
  }

  // 2. Pack the artifact exactly as `pnpm publish` would.
  const packDir = mkdtempSync(join(tmpdir(), "fr-e2e-pack-"))
  sh("pnpm", ["pack", "--pack-destination", packDir], repoRoot)
  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"))
  if (!tgz) {
    throw new Error(`[fr-e2e] pnpm pack produced no tarball in ${packDir}`)
  }
  const tarballPath = join(packDir, tgz)
  stamp("tarball", tarballPath)

  // 3. Install the tarball once into a throwaway "tool" project so the
  //    CLI has its runtime dependencies. This is the CLI that scaffolds;
  //    each scaffolded project then installs the same tarball itself.
  let cliPath = process.env.FR_E2E_BIN
  let toolDir: string | undefined
  if (!cliPath) {
    toolDir = mkdtempSync(join(tmpdir(), "fr-e2e-tool-"))
    writeFileSync(
      join(toolDir, "package.json"),
      JSON.stringify({ name: "fr-e2e-tool", private: true }, null, 2),
      "utf-8",
    )
    sh("pnpm", ["add", tarballPath, "--prefer-offline"], toolDir)
    cliPath = join(
      toolDir,
      "node_modules",
      "@flink-reactor",
      "dsl",
      "dist",
      "cli.js",
    )
  }
  if (!existsSync(cliPath)) {
    throw new Error(`[fr-e2e] CLI entry not found at ${cliPath}`)
  }
  stamp("cli", cliPath)

  project.provide("frE2eTarball", tarballPath)
  project.provide("frE2eCli", cliPath)

  return () => {
    if (keep) {
      stamp("keep", packDir)
      if (toolDir) stamp("keep", toolDir)
      return
    }
    rmSync(packDir, { recursive: true, force: true })
    if (toolDir) rmSync(toolDir, { recursive: true, force: true })
  }
}
