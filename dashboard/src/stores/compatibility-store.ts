import { gql } from "urql"
import { create } from "zustand"
import {
  mapCompatibilityReport,
  mapManifestVersions,
  mapPipelineSummaries,
  mapRestoreEvents,
} from "@/data/compatibility-mappers"
import type {
  CompatibilityReport,
  CompatibilityVerdict,
  PipelineManifestVersion,
  PipelineStateSummary,
  RestoreEvent,
} from "@/data/compatibility-types"
import { graphqlClient } from "@/lib/graphql-client"

/**
 * State-collision compatibility store.
 *
 * Two data planes:
 *  - **Registry-wide summaries** — one bulk query (`pipelineStateSummaries`)
 *    powering the State Registry index AND the deployment kanban's "Blocked"
 *    verdict-join. Fetched once; `verdictByPipeline` is the derived lookup the
 *    kanban consumes (avoids an N+1 over per-pipeline reports).
 *  - **Per-pipeline detail** — the latest report, manifest version history, and
 *    restore timeline for one pipeline, fetched together in parallel (no
 *    waterfall) for the deployment-detail panels and registry detail route.
 *
 * Follows the repo's established store pattern (graphqlClient.query().toPromise()
 * → mapper → state); stale data stays visible on error, only the error flag is set.
 *
 * @module compatibility-store
 */

interface CompatibilityState {
  /** Registry-wide per-pipeline rollups. */
  summaries: PipelineStateSummary[]
  /** Derived: latest verdict per pipeline name (for the kanban join). */
  verdictByPipeline: Record<string, CompatibilityVerdict>
  summariesLoading: boolean
  summariesError: string | null

  /** Pipeline the loaded detail belongs to (null before any detail fetch). */
  detailPipeline: string | null
  report: CompatibilityReport | null
  versions: PipelineManifestVersion[]
  restores: RestoreEvent[]
  detailLoading: boolean
  detailError: string | null
}

interface CompatibilityActions {
  /** Fetch all per-pipeline rollups (all environments when omitted). */
  fetchSummaries: (environment?: string) => Promise<void>
  /** Fetch report + versions + restores for one pipeline, in parallel. */
  fetchPipelineDetail: (pipeline: string, environment?: string) => Promise<void>
}

type CompatibilityStore = CompatibilityState & CompatibilityActions

const SUMMARIES_QUERY = gql`
  query PipelineStateSummaries($environment: String) {
    pipelineStateSummaries(environment: $environment) {
      pipeline
      environment
      latestVersion
      versionCount
      stateFingerprint
      flinkVersion
      lastVerdict
      lastCheckedAt
      lastIssueCount
      restoreTotal
      restoreSuccess
      updatedAt
    }
  }
`

const LATEST_REPORT_QUERY = gql`
  query LatestCompatibilityReport($pipeline: String!, $environment: String) {
    latestCompatibilityReport(pipeline: $pipeline, environment: $environment) {
      pipeline
      environment
      verdict
      canProceed
      checkedAt
      checkId
      issues {
        operatorKey
        component
        category
        severity
        message
      }
    }
  }
`

const VERSIONS_QUERY = gql`
  query PipelineManifestVersions($pipeline: String!, $environment: String) {
    pipelineManifestVersions(pipeline: $pipeline, environment: $environment) {
      id
      pipeline
      environment
      version
      flinkVersion
      stateFingerprint
      source
      createdAt
      manifestJson
    }
  }
`

const RESTORES_QUERY = gql`
  query RestoreEvents($pipeline: String!, $environment: String) {
    restoreEvents(pipeline: $pipeline, environment: $environment) {
      id
      pipeline
      environment
      cluster
      jid
      outcome
      errorCategory
      restoredCheckpointId
      blueGreenName
      observedAt
    }
  }
`

function verdictMap(
  summaries: PipelineStateSummary[],
): Record<string, CompatibilityVerdict> {
  const map: Record<string, CompatibilityVerdict> = {}
  for (const s of summaries) {
    if (s.lastVerdict) map[s.pipeline] = s.lastVerdict
  }
  return map
}

export const useCompatibilityStore = create<CompatibilityStore>((set) => ({
  summaries: [],
  verdictByPipeline: {},
  summariesLoading: false,
  summariesError: null,

  detailPipeline: null,
  report: null,
  versions: [],
  restores: [],
  detailLoading: false,
  detailError: null,

  async fetchSummaries(environment?: string) {
    set({ summariesLoading: true, summariesError: null })
    try {
      const result = await graphqlClient
        .query(SUMMARIES_QUERY, { environment })
        .toPromise()
      if (result.error) throw result.error
      const summaries = mapPipelineSummaries(
        result.data?.pipelineStateSummaries ?? [],
      )
      set({
        summaries,
        verdictByPipeline: verdictMap(summaries),
        summariesLoading: false,
      })
    } catch (err) {
      set({
        summariesError:
          err instanceof Error ? err.message : "Failed to fetch state registry",
        summariesLoading: false,
      })
    }
  },

  async fetchPipelineDetail(pipeline: string, environment?: string) {
    set({ detailLoading: true, detailError: null, detailPipeline: pipeline })
    try {
      // Parallel — the three queries are independent (no fetch waterfall).
      const [reportRes, versionsRes, restoresRes] = await Promise.all([
        graphqlClient
          .query(LATEST_REPORT_QUERY, { pipeline, environment })
          .toPromise(),
        graphqlClient
          .query(VERSIONS_QUERY, { pipeline, environment })
          .toPromise(),
        graphqlClient
          .query(RESTORES_QUERY, { pipeline, environment })
          .toPromise(),
      ])
      const firstError =
        reportRes.error ?? versionsRes.error ?? restoresRes.error
      if (firstError) throw firstError

      const rawReport = reportRes.data?.latestCompatibilityReport
      set({
        report: rawReport ? mapCompatibilityReport(rawReport) : null,
        versions: mapManifestVersions(
          versionsRes.data?.pipelineManifestVersions ?? [],
        ),
        restores: mapRestoreEvents(restoresRes.data?.restoreEvents ?? []),
        detailLoading: false,
      })
    } catch (err) {
      set({
        detailError:
          err instanceof Error
            ? err.message
            : "Failed to fetch pipeline state detail",
        detailLoading: false,
      })
    }
  },
}))
