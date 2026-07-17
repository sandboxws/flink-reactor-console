/**
 * Pure derivations for the Schema Registry instrument view.
 *
 * The "conflict" signal is a governance heuristic, not a per-field breaking-
 * change analysis (that lives in the schema-governance work). A subject is
 * flagged when it has NO compatibility enforcement (`NONE`) or when its
 * per-subject level is weaker than the registry's global default.
 *
 * `compatRank` collapses Confluent's compatibility levels into a single
 * strength ordering. This is a policy choice — teams that weight FORWARD vs
 * BACKWARD differently can adjust the ranking here.
 */

import type { SchemaSubject } from "@/lib/instruments-data"

/**
 * Strength ranking for Schema Registry compatibility levels (higher = stricter).
 * Unknown/blank levels rank as `null` so callers can decide not to flag them.
 */
export function compatRank(level: string): number | null {
  switch (level.toUpperCase()) {
    case "NONE":
      return 0
    case "BACKWARD":
    case "FORWARD":
      return 1
    case "BACKWARD_TRANSITIVE":
    case "FORWARD_TRANSITIVE":
      return 2
    case "FULL":
      return 3
    case "FULL_TRANSITIVE":
      return 4
    default:
      return null
  }
}

/**
 * A subject conflicts with governance when it has no enforcement (`NONE`) or
 * its compatibility is weaker than the registry default. Unknown levels (and
 * an unknown default) are not flagged — we only flag what we can reason about.
 */
export function isSubjectConflict(
  subject: SchemaSubject,
  defaultCompat: string,
): boolean {
  const rank = compatRank(subject.compatibility)
  if (rank === null) return false
  if (rank === 0) return true // NONE — unguarded
  const defaultRank = compatRank(defaultCompat)
  if (defaultRank === null) return false
  return rank < defaultRank
}

/** Subjects flagged as governance conflicts. */
export function conflictSubjects(
  subjects: SchemaSubject[],
  defaultCompat: string,
): SchemaSubject[] {
  return subjects.filter((s) => isSubjectConflict(s, defaultCompat))
}

export interface SchemaRegistryKpis {
  subjects: number
  versions: number
  defaultCompat: string
  conflicts: number
}

/** Derive the schema-registry KPI strip. `versions` is Σ latest version (a proxy). */
export function registryKpis(
  subjects: SchemaSubject[],
  defaultCompat: string,
): SchemaRegistryKpis {
  return {
    subjects: subjects.length,
    versions: subjects.reduce((sum, s) => sum + s.latestVersion, 0),
    defaultCompat: defaultCompat || "—",
    conflicts: conflictSubjects(subjects, defaultCompat).length,
  }
}

/**
 * Map a Schema Registry subject to its Kafka topic via the default
 * TopicNameStrategy (`<topic>-value` / `<topic>-key`). Returns null when the
 * subject does not follow that convention.
 */
export function subjectTopic(subjectName: string): string | null {
  const m = subjectName.match(/^(.*)-(value|key)$/)
  return m ? m[1] : null
}
