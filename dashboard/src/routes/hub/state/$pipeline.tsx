/**
 * Hub State Registry detail — /hub/state/$pipeline.
 *
 * The durable, pipeline-centric view of state-collision detection: latest
 * compatibility report, full manifest version history (with diff), and the
 * restore-outcome timeline. Reuses the same panels as the deployment-detail
 * route (Phase 7). An optional `environment` search param scopes to a single
 * environment (defaults to the server's default environment).
 */

import { HubBreadcrumb, SevBadge } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { History, Layers, ShieldCheck } from "lucide-react"
import { useEffect, useMemo } from "react"
import { CompatibilityPanel } from "@/components/hub/deployments/compatibility-panel"
import { ManifestVersionHistory } from "@/components/hub/deployments/manifest-version-history"
import { RestoreTimeline } from "@/components/hub/deployments/restore-timeline"
import {
  restoreSuccessRate,
  shortFingerprint,
  verdictLabel,
  verdictTone,
} from "@/data/compatibility-types"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useCompatibilityStore } from "@/stores/compatibility-store"

interface PipelineSearch {
  environment?: string
}

function KvCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="font-mono text-[12px] text-fg truncate">{value}</div>
    </div>
  )
}

function HubStatePipelineDetail() {
  const { pipeline } = useParams({ from: "/hub/state/$pipeline" })
  const { environment } = useSearch({ from: "/hub/state/$pipeline" })

  const report = useCompatibilityStore((s) => s.report)
  const versions = useCompatibilityStore((s) => s.versions)
  const restores = useCompatibilityStore((s) => s.restores)
  const detailLoading = useCompatibilityStore((s) => s.detailLoading)
  const detailError = useCompatibilityStore((s) => s.detailError)
  const fetchPipelineDetail = useCompatibilityStore(
    (s) => s.fetchPipelineDetail,
  )
  const summaries = useCompatibilityStore((s) => s.summaries)
  const fetchSummaries = useCompatibilityStore((s) => s.fetchSummaries)

  useEffect(() => {
    fetchPipelineDetail(pipeline, environment)
    fetchSummaries(environment)
  }, [pipeline, environment, fetchPipelineDetail, fetchSummaries])

  const summary = useMemo(
    () =>
      summaries.find(
        (s) =>
          s.pipeline === pipeline &&
          (!environment || s.environment === environment),
      ) ?? null,
    [summaries, pipeline, environment],
  )

  const rate = summary ? restoreSuccessRate(summary) : null

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "State registry", to: "/hub/state" },
          { label: pipeline, mono: true },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          {pipeline}
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          environment{" "}
          <code className="font-mono">
            {summary?.environment ?? environment ?? "default"}
          </code>
        </p>
      </div>

      {/* Rollup KPIs */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KvCard
          label="Fingerprint"
          value={summary ? shortFingerprint(summary.stateFingerprint) : "—"}
        />
        <KvCard
          label="Last verdict"
          value={
            summary?.lastVerdict ? (
              <SevBadge tone={verdictTone(summary.lastVerdict)}>
                {verdictLabel(summary.lastVerdict)}
              </SevBadge>
            ) : (
              "—"
            )
          }
        />
        <KvCard
          label="Restore success"
          value={
            rate == null
              ? "—"
              : `${rate}% (${summary?.restoreSuccess}/${summary?.restoreTotal})`
          }
        />
        <KvCard
          label="Versions"
          value={
            summary
              ? `v${summary.latestVersion} (${summary.versionCount})`
              : "—"
          }
        />
      </section>

      {/* State compatibility */}
      <section className="glass-card-static mb-5 p-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <ShieldCheck className="size-3.5" />
          State compatibility
        </h3>
        <CompatibilityPanel
          report={report}
          loading={detailLoading}
          error={detailError}
        />
      </section>

      {/* Manifest version history */}
      <section className="glass-card-static mb-5 p-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <Layers className="size-3.5" />
          State manifest history
        </h3>
        <ManifestVersionHistory
          versions={versions}
          loading={detailLoading}
          error={detailError}
        />
      </section>

      {/* Restore outcomes */}
      <section className="glass-card-static mb-5 p-5">
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <History className="size-3.5" />
          Restore outcomes
        </h3>
        <RestoreTimeline
          restores={restores}
          loading={detailLoading}
          error={detailError}
        />
      </section>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/state/$pipeline")({
  validateSearch: (search: Record<string, unknown>): PipelineSearch => ({
    environment:
      typeof search.environment === "string" ? search.environment : undefined,
  }),
  component: HubStatePipelineDetail,
})
