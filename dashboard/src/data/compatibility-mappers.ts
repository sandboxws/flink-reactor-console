/**
 * Pure mappers: GraphQL responses → compatibility domain types.
 *
 * No side effects, no store access. Unknown enum values fall back to safe
 * defaults (verdict → INCOMPATIBLE so an unrecognized state fails closed;
 * outcome → UNKNOWN; severity → WARNING).
 *
 * @module
 */
import type {
  CompatibilityIssue,
  CompatibilityReport,
  CompatibilityVerdict,
  IssueSeverity,
  PipelineManifestVersion,
  PipelineStateSummary,
  RestoreEvent,
  RestoreOutcome,
} from "./compatibility-types"

interface GqlIssue {
  operatorKey: string
  component: string
  category: string
  severity: string
  message: string
}

interface GqlReport {
  pipeline: string
  environment: string
  verdict: string
  canProceed: boolean
  issues: GqlIssue[] | null
  checkedAt: string | null
  checkId: string | null
}

interface GqlManifestVersion {
  id: string
  pipeline: string
  environment: string
  version: number
  flinkVersion: string | null
  stateFingerprint: string
  source: string
  createdAt: string
  manifestJson: string
}

interface GqlRestoreEvent {
  id: string
  pipeline: string
  environment: string
  cluster: string
  jid: string | null
  outcome: string
  errorCategory: string | null
  restoredCheckpointId: number | null
  blueGreenName: string | null
  observedAt: string
}

interface GqlSummary {
  pipeline: string
  environment: string
  latestVersion: number
  versionCount: number
  stateFingerprint: string
  flinkVersion: string | null
  lastVerdict: string | null
  lastCheckedAt: string | null
  lastIssueCount: number | null
  restoreTotal: number
  restoreSuccess: number
  updatedAt: string
}

const VALID_VERDICTS = new Set(["COMPATIBLE", "WARNING", "INCOMPATIBLE"])
const VALID_OUTCOMES = new Set(["PENDING", "SUCCESS", "FAILED", "UNKNOWN"])

/** Normalize a verdict string; unknown values fail closed to INCOMPATIBLE. */
function mapVerdict(raw: string | null): CompatibilityVerdict {
  if (raw && VALID_VERDICTS.has(raw)) return raw as CompatibilityVerdict
  return "INCOMPATIBLE"
}

function mapSeverity(raw: string): IssueSeverity {
  return raw === "ERROR" ? "ERROR" : "WARNING"
}

function mapOutcome(raw: string): RestoreOutcome {
  if (VALID_OUTCOMES.has(raw)) return raw as RestoreOutcome
  return "UNKNOWN"
}

function mapIssue(raw: GqlIssue): CompatibilityIssue {
  return {
    operatorKey: raw.operatorKey,
    component: raw.component,
    category: raw.category,
    severity: mapSeverity(raw.severity),
    message: raw.message,
  }
}

export function mapCompatibilityReport(raw: GqlReport): CompatibilityReport {
  return {
    pipeline: raw.pipeline,
    environment: raw.environment,
    verdict: mapVerdict(raw.verdict),
    canProceed: raw.canProceed,
    issues: (raw.issues ?? []).map(mapIssue),
    checkedAt: raw.checkedAt,
    checkId: raw.checkId,
  }
}

export function mapManifestVersion(
  raw: GqlManifestVersion,
): PipelineManifestVersion {
  return {
    id: raw.id,
    pipeline: raw.pipeline,
    environment: raw.environment,
    version: raw.version,
    flinkVersion: raw.flinkVersion,
    stateFingerprint: raw.stateFingerprint,
    source: raw.source,
    createdAt: raw.createdAt,
    manifestJson: raw.manifestJson,
  }
}

export function mapManifestVersions(
  raw: GqlManifestVersion[],
): PipelineManifestVersion[] {
  return raw.map(mapManifestVersion)
}

export function mapRestoreEvent(raw: GqlRestoreEvent): RestoreEvent {
  return {
    id: raw.id,
    pipeline: raw.pipeline,
    environment: raw.environment,
    cluster: raw.cluster,
    jid: raw.jid,
    outcome: mapOutcome(raw.outcome),
    errorCategory: raw.errorCategory,
    restoredCheckpointId: raw.restoredCheckpointId,
    blueGreenName: raw.blueGreenName,
    observedAt: raw.observedAt,
  }
}

export function mapRestoreEvents(raw: GqlRestoreEvent[]): RestoreEvent[] {
  return raw.map(mapRestoreEvent)
}

export function mapPipelineSummary(raw: GqlSummary): PipelineStateSummary {
  return {
    pipeline: raw.pipeline,
    environment: raw.environment,
    latestVersion: raw.latestVersion,
    versionCount: raw.versionCount,
    stateFingerprint: raw.stateFingerprint,
    flinkVersion: raw.flinkVersion,
    lastVerdict: raw.lastVerdict ? mapVerdict(raw.lastVerdict) : null,
    lastCheckedAt: raw.lastCheckedAt,
    lastIssueCount: raw.lastIssueCount,
    restoreTotal: raw.restoreTotal,
    restoreSuccess: raw.restoreSuccess,
    updatedAt: raw.updatedAt,
  }
}

export function mapPipelineSummaries(
  raw: GqlSummary[],
): PipelineStateSummary[] {
  return raw.map(mapPipelineSummary)
}
