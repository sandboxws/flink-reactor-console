#!/usr/bin/env tsx
/**
 * Exports the local Kafka seed fixtures (`SEED_SUBJECTS`) to a JSON artifact
 * consumed by the flink-reactor-console Kafka instrument's seeding feature.
 *
 * The DSL is the single source of truth for seed data; the console vendors
 * this artifact and embeds it via `go:embed`. Regenerate the vendored copy
 * with `flink-reactor-console/scripts/refresh-seeds.sh`.
 *
 * Usage:
 *   pnpm seeds:export
 *
 * Output: `assets/seeds.json` — committed and kept deterministic (no
 * timestamps). The catalog shape lives in `src/cli/cluster/seed-catalog.ts`;
 * `src/cli/cluster/__tests__/seed-catalog.test.ts` fails (in CI via
 * `pnpm test`) whenever the fixtures change without a matching re-export.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pc from "picocolors"
import { buildSeedCatalog } from "../src/cli/cluster/seed-catalog"

const catalog = buildSeedCatalog()

const REPO_ROOT = join(import.meta.dirname, "..")
const ASSETS_DIR = join(REPO_ROOT, "assets")
const OUT_FILE = join(ASSETS_DIR, "seeds.json")

mkdirSync(ASSETS_DIR, { recursive: true })
writeFileSync(OUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`)

const rowCount = catalog.subjects.reduce((n, s) => n + s.sampleRows.length, 0)
const domainCount = new Set(catalog.subjects.map((s) => s.domain)).size
console.log(
  pc.green(
    `✓ exported ${catalog.subjects.length} topics (${rowCount} sample rows, ${domainCount} domains) → assets/seeds.json`,
  ),
)
