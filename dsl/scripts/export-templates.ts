#!/usr/bin/env tsx
/**
 * Exports the template-library projection (`buildTemplatesArtifact()`) to a
 * JSON artifact consumed by the flink-reactor-console templates GraphQL API.
 *
 * The DSL is the single source of truth for the template registry; the console
 * vendors this artifact and embeds it via `go:embed`. Regenerate the vendored
 * copy with `flink-reactor-console/scripts/refresh-templates.sh`.
 *
 * Usage:
 *   pnpm templates:export
 *
 * Output: `assets/templates.generated.json` — committed and kept deterministic
 * (no timestamps). Drift between this artifact and `TEMPLATE_FACTORIES` fails
 * `src/templates/__tests__/manifest.test.ts` in CI.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pc from "picocolors"
import { buildTemplatesArtifact } from "../src/templates/manifest"

const artifact = buildTemplatesArtifact()

const REPO_ROOT = join(import.meta.dirname, "..")
const ASSETS_DIR = join(REPO_ROOT, "assets")
const OUT_FILE = join(ASSETS_DIR, "templates.generated.json")

mkdirSync(ASSETS_DIR, { recursive: true })
writeFileSync(OUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`)

const fileCount = Object.values(artifact.sources).reduce(
  (n, s) => n + s.files.length,
  0,
)
console.log(
  pc.green(
    `✓ exported ${artifact.count} templates (${fileCount} scaffolded files) → assets/templates.generated.json`,
  ),
)
