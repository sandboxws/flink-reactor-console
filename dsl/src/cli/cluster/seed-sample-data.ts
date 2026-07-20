// Lane-agnostic Kafka sample-data seeding.
//
// Both the Docker (`cluster up`) and minikube (`sim up`) lanes want the same
// thing: for a set of topics, produce each subject's deterministic
// `sampleRows` (from the `SEED_SUBJECTS` table) so pipelines and the console
// have data to read. Only the *transport* differs — Docker pipes through
// `compose exec kafka …`, minikube through `kubectl exec … sts/kafka`, and
// registration is host-side HTTP in Docker but pod-exec in minikube. This
// module owns the shared selection + orchestration; callers inject the
// lane-specific `produce`/`register`/`shouldSkip` closures.

import type { SeedSubject } from "@/cli/cluster/schema-registry-seed.js"
import type { FlinkReactorConfig } from "@/core/config.js"

/**
 * Scope of the `--samples` option shared by `cluster up` and `sim up`:
 * `declared` seeds this project's declared topics (the default), `all` seeds
 * the entire sample catalog, `none` skips sample seeding entirely.
 */
export type SampleScope = "declared" | "all" | "none"

/**
 * Select the `SEED_SUBJECTS` entries to act on for a topic set. `"all"` returns
 * every subject; otherwise entries are filtered by exact topic-name match (the
 * same join the sim lane uses). Subjects with no `sampleRows` are still
 * returned — the caller decides whether to register-but-not-produce them.
 */
export function selectSubjectsForTopics(
  subjects: readonly SeedSubject[],
  topics: readonly string[] | "all",
): SeedSubject[] {
  if (topics === "all") return [...subjects]
  const wanted = new Set(topics)
  return subjects.filter((s) => wanted.has(s.topic))
}

/**
 * Collect every Kafka topic a project declares, across all sources of truth:
 *   - top-level `sources` entries of `type: "kafka"` (the `schema generate` block);
 *   - every environment's `sim.init.kafka.topics`; and
 *   - every environment's `sim.init.kafka.catalogs[].tables[].topic`.
 *
 * Unions across all environments (a topic declared in any env is a project
 * topic) and returns a sorted, de-duplicated list. Pure — takes an already
 * loaded config so it is trivially testable.
 */
export function collectDeclaredKafkaTopics(
  config: FlinkReactorConfig,
): string[] {
  const topics = new Set<string>()

  for (const src of Object.values(config.sources ?? {})) {
    if (src.type === "kafka" && src.topic) topics.add(src.topic)
  }

  for (const env of Object.values(config.environments ?? {})) {
    const kafka = env.sim?.init?.kafka
    if (!kafka) continue
    for (const topic of kafka.topics ?? []) topics.add(topic)
    for (const cat of kafka.catalogs ?? []) {
      for (const table of cat.tables ?? []) {
        if (table.topic) topics.add(table.topic)
      }
    }
  }

  return [...topics].sort()
}

/** Load the project config from `cwd` and resolve its declared Kafka topics. */
export async function resolveDeclaredKafkaTopics(
  cwd: string = process.cwd(),
): Promise<string[]> {
  const { loadConfig } = await import("@/cli/discovery.js")
  const config = await loadConfig(cwd)
  return config ? collectDeclaredKafkaTopics(config) : []
}

/**
 * Sum the per-partition end offsets from `kafka-get-offsets.sh` output
 * (lines shaped `topic:partition:offset`). Both lanes' idempotency guards
 * parse through this. Lines that don't match the shape (broker warnings,
 * blank lines) are ignored rather than treated as zeroes-or-errors, so the
 * guard stays a best-effort signal instead of a hard dependency on the
 * tool's exact logging.
 */
export function sumOffsetOutput(out: string): number {
  let total = 0
  for (const line of out.split("\n")) {
    const match = /^.+:\d+:(\d+)\s*$/.exec(line)
    const offset = match?.[1]
    if (offset !== undefined) total += Number.parseInt(offset, 10)
  }
  return total
}

export interface SeedKafkaSampleDataOptions {
  /** Topics to seed. `"all"` seeds every catalog subject. */
  readonly topics: readonly string[] | "all"
  /** Produce JSON-encoded rows to a topic. Lane-specific transport. */
  readonly produce: (
    topic: string,
    jsonLines: readonly string[],
  ) => void | Promise<void>
  /**
   * Optional per-subject schema registration. The Docker lane leaves this
   * undefined (registration already ran host-side via `registerSeedSchemas`);
   * the minikube lane injects a pod-exec registrar. Best-effort — a throwing
   * registrar is swallowed and counted as not-registered.
   */
  readonly register?: (entry: SeedSubject) => void | Promise<void>
  /**
   * Optional idempotency guard, checked before producing. Return `true` to
   * skip a topic that already has data so re-running is safe. Registration (if
   * any) still runs — it is independently idempotent.
   */
  readonly shouldSkip?: (topic: string) => boolean | Promise<boolean>
  /** Override the catalog (tests). Defaults to the embedded `SEED_SUBJECTS`. */
  readonly subjects?: readonly SeedSubject[]
}

export interface SeedKafkaSampleDataResult {
  readonly produced: number
  readonly registered: number
  readonly seededTopics: string[]
  readonly skipped: string[]
}

/**
 * Orchestrate sample-data seeding for a topic set. Every step is best-effort:
 * a failing register or produce is swallowed so seeding never aborts the
 * broader `cluster up` / `sim up` flow.
 */
export async function seedKafkaSampleData(
  opts: SeedKafkaSampleDataOptions,
): Promise<SeedKafkaSampleDataResult> {
  const subjects =
    opts.subjects ??
    (await import("@/cli/cluster/schema-registry-seed.js")).SEED_SUBJECTS
  const selected = selectSubjectsForTopics(subjects, opts.topics)

  let produced = 0
  let registered = 0
  const seededTopics: string[] = []
  const skipped: string[] = []

  for (const entry of selected) {
    if (opts.register) {
      try {
        await opts.register(entry)
        registered++
      } catch {
        // Registry not ready or subject already registered — best-effort.
      }
    }

    const rows = entry.sampleRows ?? []
    if (rows.length === 0) continue

    if (opts.shouldSkip && (await opts.shouldSkip(entry.topic))) {
      skipped.push(entry.topic)
      continue
    }

    try {
      await opts.produce(
        entry.topic,
        rows.map((row) => JSON.stringify(row)),
      )
      produced += rows.length
      seededTopics.push(entry.topic)
    } catch {
      // Broker not ready — best-effort.
    }
  }

  return { produced, registered, seededTopics, skipped }
}
