// The exported seed-catalog artifact contract.
//
// `assets/seeds.json` is the committed, deterministic export of
// `SEED_SUBJECTS` that external consumers vendor — today the
// flink-reactor-console Kafka instrument (via `go:embed`, refreshed by
// `flink-reactor-console/scripts/refresh-seeds.sh`). This module is the
// single place that defines the artifact's shape; `scripts/export-seeds.ts`
// writes it and `__tests__/seed-catalog.test.ts` fails CI when the committed
// artifact drifts from the fixtures.
//
// Byte-stability contract: key order below (`topic`, `subject`, `domain`,
// `jsonSchema`, `sampleRows`) plus the writer's `JSON.stringify(…, null, 2)`
// + trailing newline must not change without bumping `CATALOG_VERSION` and
// re-vendoring the console copy.

import {
  SEED_SUBJECTS,
  type SeedSubject,
  subjectFor,
} from "@/cli/cluster/schema-registry-seed.js"

/** Schema version of the exported artifact. Bump on breaking shape changes. */
export const CATALOG_VERSION = 1

export interface SeedCatalogSubject {
  readonly topic: string
  readonly subject: string
  readonly domain: string
  readonly jsonSchema: Record<string, unknown>
  readonly sampleRows: readonly Record<string, unknown>[]
}

export interface SeedCatalog {
  readonly version: number
  readonly subjects: readonly SeedCatalogSubject[]
}

/** Map the seed fixtures to the exported artifact shape. Pure. */
export function buildSeedCatalog(
  subjects: readonly SeedSubject[] = SEED_SUBJECTS,
): SeedCatalog {
  return {
    version: CATALOG_VERSION,
    subjects: subjects.map((entry) => ({
      topic: entry.topic,
      subject: subjectFor(entry),
      domain: entry.domain,
      jsonSchema: entry.jsonSchema,
      sampleRows: entry.sampleRows ?? [],
    })),
  }
}
