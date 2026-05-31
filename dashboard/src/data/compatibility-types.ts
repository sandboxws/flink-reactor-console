/**
 * Domain types for state-collision detection: compatibility verdicts, per-operator
 * issues, versioned State Manifests, restore outcomes, and per-pipeline rollups.
 *
 * Mirrors the GraphQL `compatibility.graphqls` contract (state-collision-03).
 * These are the "public" types the State Registry routes, the deployment-detail
 * panels, and the kanban verdict-join consume. Mapping from raw GraphQL lives in
 * `compatibility-mappers.ts`.
 *
 * @module
 */

import type { SevTone } from "@flink-reactor/ui"

/** Overall verdict of comparing a proposed manifest against the stored latest. */
export type CompatibilityVerdict = "COMPATIBLE" | "WARNING" | "INCOMPATIBLE"

/** Severity of a single compatibility issue. */
export type IssueSeverity = "WARNING" | "ERROR"

/** Observed outcome of a Flink restore from checkpoint/savepoint. */
export type RestoreOutcome = "PENDING" | "SUCCESS" | "FAILED" | "UNKNOWN"

/** A single per-operator compatibility finding. */
export interface CompatibilityIssue {
  readonly operatorKey: string
  readonly component: string
  /** MAX_PARALLELISM | UNMAPPED_STATE | SERIALIZER | SCHEMA_EVOLUTION | … */
  readonly category: string
  readonly severity: IssueSeverity
  readonly message: string
}

/** The result of comparing two manifest versions. */
export interface CompatibilityReport {
  readonly pipeline: string
  readonly environment: string
  readonly verdict: CompatibilityVerdict
  readonly canProceed: boolean
  readonly issues: readonly CompatibilityIssue[]
  /** ISO timestamp; null for a non-persisted preview. */
  readonly checkedAt: string | null
  /** Set when the check was persisted. */
  readonly checkId: string | null
}

/** One stored State Manifest version. */
export interface PipelineManifestVersion {
  readonly id: string
  readonly pipeline: string
  readonly environment: string
  readonly version: number
  readonly flinkVersion: string | null
  readonly stateFingerprint: string
  readonly source: string
  readonly createdAt: string
  /** Full canonical manifest JSON (sorted keys) — used for version diffing. */
  readonly manifestJson: string
}

/** One observed restore outcome. */
export interface RestoreEvent {
  readonly id: string
  readonly pipeline: string
  readonly environment: string
  readonly cluster: string
  readonly jid: string | null
  readonly outcome: RestoreOutcome
  readonly errorCategory: string | null
  readonly restoredCheckpointId: number | null
  readonly blueGreenName: string | null
  readonly observedAt: string
}

/** Per-(pipeline, environment) rollup for the registry index + kanban join. */
export interface PipelineStateSummary {
  readonly pipeline: string
  readonly environment: string
  readonly latestVersion: number
  readonly versionCount: number
  readonly stateFingerprint: string
  readonly flinkVersion: string | null
  readonly lastVerdict: CompatibilityVerdict | null
  readonly lastCheckedAt: string | null
  readonly lastIssueCount: number | null
  readonly restoreTotal: number
  readonly restoreSuccess: number
  readonly updatedAt: string
}

// ── Presentation helpers ────────────────────────────────────────────────────
// SevBadge/StatePill apply their own CSS via the `tone`/`state` prop, so these
// return prop values — no templated Tailwind class names (Hub rule #6).

/** SevBadge tone for a verdict: COMPATIBLE→ok, WARNING→warn, INCOMPATIBLE→fail. */
export function verdictTone(verdict: CompatibilityVerdict): SevTone {
  switch (verdict) {
    case "COMPATIBLE":
      return "ok"
    case "WARNING":
      return "warn"
    case "INCOMPATIBLE":
      return "fail"
  }
}

/** Human label for a verdict. */
export function verdictLabel(verdict: CompatibilityVerdict): string {
  switch (verdict) {
    case "COMPATIBLE":
      return "Compatible"
    case "WARNING":
      return "Compatible with warnings"
    case "INCOMPATIBLE":
      return "Incompatible"
  }
}

/** SevBadge tone for an issue severity. */
export function severityTone(severity: IssueSeverity): SevTone {
  return severity === "ERROR" ? "fail" : "warn"
}

/** SevBadge tone for a restore outcome. */
export function outcomeTone(outcome: RestoreOutcome): SevTone {
  switch (outcome) {
    case "SUCCESS":
      return "ok"
    case "FAILED":
      return "fail"
    case "PENDING":
      return "muted"
    case "UNKNOWN":
      return "info"
  }
}

/** Human label for a restore-failure category code. */
export function categoryLabel(category: string): string {
  switch (category) {
    case "MAX_PARALLELISM":
      return "Max parallelism"
    case "UNMAPPED_STATE":
      return "Unmapped state"
    case "MISSING_OPERATOR":
      return "Missing operator"
    case "SERIALIZER":
      return "Serializer"
    case "SCHEMA_EVOLUTION":
      return "Schema evolution"
    case "STATE_MIGRATION":
      return "State migration"
    case "UNKNOWN":
      return "Uncategorized"
    default:
      return category
  }
}

/**
 * Restore success rate as a 0–100 integer, or null when no terminal restores
 * have been observed (so callers can render "—" instead of a misleading 0%).
 */
export function restoreSuccessRate(
  summary: Pick<PipelineStateSummary, "restoreTotal" | "restoreSuccess">,
): number | null {
  if (summary.restoreTotal <= 0) return null
  return Math.round((summary.restoreSuccess / summary.restoreTotal) * 100)
}

/** Short fingerprint for compact display (first 10 hex chars). */
export function shortFingerprint(fp: string): string {
  return fp.length <= 12 ? fp : fp.slice(0, 10)
}
