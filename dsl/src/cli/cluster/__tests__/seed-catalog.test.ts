import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildSeedCatalog,
  CATALOG_VERSION,
} from "@/cli/cluster/seed-catalog.js"

const ARTIFACT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "assets",
  "seeds.json",
)

describe("buildSeedCatalog", () => {
  it("produces a well-formed catalog from the embedded fixtures", () => {
    const catalog = buildSeedCatalog()
    expect(catalog.version).toBe(CATALOG_VERSION)
    expect(catalog.subjects.length).toBeGreaterThan(0)
    for (const subject of catalog.subjects) {
      expect(subject.topic).not.toBe("")
      expect(subject.subject).toBe(`${subject.topic}-value`)
      expect(subject.domain).not.toBe("")
      expect(subject.jsonSchema).toBeTypeOf("object")
      expect(Array.isArray(subject.sampleRows)).toBe(true)
    }
  })
})

describe("assets/seeds.json drift guard", () => {
  // The committed artifact is vendored by flink-reactor-console (go:embed),
  // so fixture edits MUST be re-exported or the console silently seeds stale
  // data. This is the CI check `scripts/export-seeds.ts` promises.
  it("matches the current SEED_SUBJECTS export exactly", () => {
    const committed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8"))
    expect(
      committed,
      "assets/seeds.json is stale — run `pnpm seeds:export` and commit the result",
    ).toEqual(buildSeedCatalog())
  })
})
