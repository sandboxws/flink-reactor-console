import { existsSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { ScaffoldOptions, TemplateName } from "@/cli/commands/new.js"
import { scaffoldProject } from "@/cli/commands/new.js"
import { runSynth } from "@/cli/commands/synth.js"
import type { PipelineArtifact } from "@/core/app.js"

const REPO_ROOT = resolve(__dirname, "../../../../../")

// `EXPECTED_PIPELINES` moved to `src/cli/templates/expected-pipelines.ts` so
// the (non-test) template manifest can read it without importing this helper.
// Re-exported here to keep existing test imports (`./helpers/scaffold-and-synth`)
// working unchanged.
export { EXPECTED_PIPELINES } from "../../expected-pipelines.js"

/**
 * Scaffolds `template` into a fresh temp dir, symlinks the built
 * `@flink-reactor/dsl` package so template imports resolve, then runs
 * `runSynth` and returns the artifacts plus the temp dir (for cleanup
 * by the caller).
 *
 * Requires `pnpm build` to have run — checked once on first call.
 */
export async function scaffoldAndSynth(
  template: TemplateName,
  overrides?: Partial<ScaffoldOptions>,
): Promise<{ artifacts: PipelineArtifact[]; tempRoot: string }> {
  ensureBuilt()

  const tempRoot = mkdtempSync(join(tmpdir(), "fr-scaffold-"))
  const projectDir = join(tempRoot, "app")

  const opts: ScaffoldOptions = {
    projectName: "scaffold-synth-test",
    template,
    pm: "pnpm",
    flinkVersion: "2.0",
    gitInit: false,
    installDeps: false,
    ...overrides,
  }

  scaffoldProject(projectDir, opts)
  linkDslPackage(projectDir)

  const artifacts = await runSynth({ outdir: "dist", projectDir })
  return { artifacts, tempRoot }
}

export const REPO_ROOT_PATH = REPO_ROOT

export function linkDslPackage(projectDir: string): void {
  const scope = join(projectDir, "node_modules", "@flink-reactor")
  mkdirSync(scope, { recursive: true })
  symlinkSync(REPO_ROOT, join(scope, "dsl"), "dir")
}

let builtChecked = false
export function ensureBuilt(): void {
  if (builtChecked) return
  const distIndex = join(REPO_ROOT, "dist", "index.js")
  if (!existsSync(distIndex)) {
    throw new Error(
      `Expected ${distIndex} to exist. Run \`pnpm build\` before these tests.`,
    )
  }
  builtChecked = true
}
