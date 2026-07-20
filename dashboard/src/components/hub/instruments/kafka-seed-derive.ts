/**
 * Pure derivations for the Kafka seed dialog.
 *
 * The dialog auto-runs a broker-aware dry-run and renders its per-topic plan.
 * Domain selection filters that plan client-side (the same domain strings the
 * server filters on for the real run), so everything the confirm button
 * promises is computed here from the dry-run rows — unit-testable and free of
 * component state.
 */

import type { KafkaSeededTopic, KafkaSeedResult } from "@/lib/instruments-data"

/** Unique, sorted domains present in a plan's rows. */
export function availableDomains(rows: readonly KafkaSeededTopic[]): string[] {
  return [...new Set(rows.map((r) => r.domain))].sort()
}

/**
 * Restrict plan rows to the selected domains. An empty selection means "all
 * domains" — matching the mutation, where omitting `domains` applies none.
 */
export function filterRowsByDomains(
  rows: readonly KafkaSeededTopic[],
  domains: readonly string[],
): KafkaSeededTopic[] {
  if (domains.length === 0) return [...rows]
  const want = new Set(domains)
  return rows.filter((r) => want.has(r.domain))
}

export interface SeedPlanSummary {
  /** Rows that will actually receive records. */
  topics: number
  /** Records the run would produce across those rows. */
  records: number
  /** Rows skipped because the topic already holds records. */
  skipped: number
  /** Rows that failed (real runs only). */
  errored: number
}

/** Summarize plan rows into the numbers the dialog footer shows. */
export function planSummary(
  rows: readonly KafkaSeededTopic[],
): SeedPlanSummary {
  const summary: SeedPlanSummary = {
    topics: 0,
    records: 0,
    skipped: 0,
    errored: 0,
  }
  for (const row of rows) {
    if (row.error) {
      summary.errored++
      continue
    }
    if (row.skipped) {
      summary.skipped++
      continue
    }
    if (row.recordsProduced > 0) {
      summary.topics++
      summary.records += row.recordsProduced
    }
  }
  return summary
}

/** True when a run would produce nothing (confirm button disabled). */
export function nothingToSeed(summary: SeedPlanSummary): boolean {
  return summary.topics === 0
}

/** Label for the confirm button, e.g. "Seed 46 records into 22 topics". */
export function confirmLabel(summary: SeedPlanSummary): string {
  if (nothingToSeed(summary)) return "Nothing to seed"
  const records = `${summary.records.toLocaleString()} record${summary.records === 1 ? "" : "s"}`
  const topics = `${summary.topics} topic${summary.topics === 1 ? "" : "s"}`
  return `Seed ${records} into ${topics}`
}

export type SeedRowTone = "create" | "append" | "skip" | "error"

export interface SeedRowStatus {
  label: string
  tone: SeedRowTone
}

/** Status cell for a plan/result row. */
export function rowStatus(row: KafkaSeededTopic): SeedRowStatus {
  if (row.error) {
    return { label: row.error, tone: "error" }
  }
  if (row.skipped) {
    return {
      label: `skip · ${row.existingRecords.toLocaleString()} records`,
      tone: "skip",
    }
  }
  if (!row.existed) {
    return { label: "will create", tone: "create" }
  }
  if (row.existingRecords > 0) {
    return {
      label: `append · ${row.existingRecords.toLocaleString()} existing`,
      tone: "append",
    }
  }
  return { label: "exists · empty", tone: "append" }
}

/**
 * The domains to send with the real run: undefined when the selection is
 * empty (server treats "no filter" and "all" identically, and omitting the
 * argument keeps the mutation minimal).
 */
export function domainsArgument(
  selected: readonly string[],
): string[] | undefined {
  return selected.length === 0 ? undefined : [...selected]
}

/** Result-line copy after a real run, e.g. "Seeded 12 records across 3 topics". */
export function resultLine(result: KafkaSeedResult): string {
  const summary = planSummary(result.topics)
  const head = result.dryRun ? "Would seed" : "Seeded"
  const parts = [
    `${head} ${summary.records.toLocaleString()} record${summary.records === 1 ? "" : "s"} across ${summary.topics} topic${summary.topics === 1 ? "" : "s"}`,
  ]
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
  if (summary.errored > 0) parts.push(`${summary.errored} failed`)
  return parts.join(" · ")
}
