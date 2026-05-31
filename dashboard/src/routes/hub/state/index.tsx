/**
 * Hub State Registry — /hub/state.
 *
 * Pipeline-centric home for state-collision detection. Manifests and restore
 * events are scoped per (pipeline, environment) — durable identity the
 * ephemeral blue-green deployment name doesn't have — so this registry gives
 * that data a stable place to live, independent of in-flight deployments.
 *
 * One bulk `pipelineStateSummaries` query backs the whole table (no N+1):
 * fingerprint, latest verdict, restore success rate, and version count per
 * pipeline. Rows link to the per-pipeline detail.
 */

import { EmptyState, HubBreadcrumb, SevBadge } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ShieldCheck } from "lucide-react"
import { useEffect } from "react"
import {
  restoreSuccessRate,
  shortFingerprint,
  verdictLabel,
  verdictTone,
} from "@/data/compatibility-types"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useCompatibilityStore } from "@/stores/compatibility-store"

function HubStateRegistry() {
  const summaries = useCompatibilityStore((s) => s.summaries)
  const loading = useCompatibilityStore((s) => s.summariesLoading)
  const error = useCompatibilityStore((s) => s.summariesError)
  const fetchSummaries = useCompatibilityStore((s) => s.fetchSummaries)

  useEffect(() => {
    fetchSummaries()
  }, [fetchSummaries])

  const blockedCount = summaries.filter(
    (s) => s.lastVerdict === "INCOMPATIBLE",
  ).length

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "State registry" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          State registry
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          {summaries.length} pipeline{summaries.length === 1 ? "" : "s"}
          {blockedCount > 0 ? (
            <span className="text-fr-coral"> · {blockedCount} blocked</span>
          ) : null}
          {loading ? " · refreshing…" : null}
        </p>
      </div>

      {error ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          Failed to load state registry: {error}
        </div>
      ) : loading && summaries.length === 0 ? (
        <div className="h-40 animate-pulse rounded bg-dash-surface/40" />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pipelines tracked yet"
          description="Run `flink-reactor synth` to push a State Manifest, and it will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-dash-border">
          <div className="grid grid-cols-[1.4fr_0.7fr_1fr_1.3fr_0.9fr_0.7fr] gap-2 bg-dash-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-fg-faint">
            <span>Pipeline</span>
            <span>Env</span>
            <span>Fingerprint</span>
            <span>Last verdict</span>
            <span>Restores</span>
            <span>Versions</span>
          </div>
          {summaries.map((s) => {
            const rate = restoreSuccessRate(s)
            return (
              <Link
                key={`${s.pipeline}::${s.environment}`}
                to="/hub/state/$pipeline"
                params={{ pipeline: s.pipeline }}
                search={{ environment: s.environment }}
                className="grid grid-cols-[1.4fr_0.7fr_1fr_1.3fr_0.9fr_0.7fr] items-center gap-2 px-3 py-2.5 text-[12px] transition-colors hover:bg-dash-surface/60"
              >
                <span className="truncate font-mono text-zinc-100">
                  {s.pipeline}
                </span>
                <span className="truncate text-fg-muted">{s.environment}</span>
                <span className="truncate font-mono text-fg-muted">
                  {shortFingerprint(s.stateFingerprint)}
                </span>
                <span>
                  {s.lastVerdict ? (
                    <SevBadge tone={verdictTone(s.lastVerdict)}>
                      {verdictLabel(s.lastVerdict)}
                    </SevBadge>
                  ) : (
                    <span className="text-fg-faint">no check</span>
                  )}
                </span>
                <span className="font-mono text-fg-muted">
                  {rate == null ? (
                    <span className="text-fg-faint">—</span>
                  ) : (
                    `${rate}% (${s.restoreSuccess}/${s.restoreTotal})`
                  )}
                </span>
                <span className="font-mono text-fg-muted">
                  v{s.latestVersion}
                  <span className="text-fg-faint"> ({s.versionCount})</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/state/")({
  component: HubStateRegistry,
})
