/**
 * Hub bottlenecks — /hub/insights/bottlenecks.
 *
 * Mirrors `console-v2/bottlenecks.html`: top hot operators (resource bars
 * sorted by composite score) + per-job vertex × subtask backpressure
 * heatmap + actionable recommendations. Reads from `useInsightsStore`'s
 * pre-computed `bottleneckScores` and `recommendations` — no per-route
 * recomputation.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Lightbulb } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { BottleneckHeatmap } from "@/components/hub/insights/bottleneck-heatmap"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useInsightsStore } from "@/stores/insights-store"

function severityColor(score: number): {
  text: string
  bar: string
} {
  if (score >= 70)
    return { text: "text-fr-coral", bar: "var(--color-fr-coral)" }
  if (score >= 40)
    return { text: "text-fr-amber", bar: "var(--color-fr-amber)" }
  return { text: "text-fg", bar: "var(--color-fr-sage)" }
}

function HubInsightsBottlenecks() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startCluster = useClusterStore((s) => s.startPolling)
  const stopCluster = useClusterStore((s) => s.stopPolling)
  const initInsights = useInsightsStore((s) => s.initialize)
  const startInsights = useInsightsStore((s) => s.startPolling)
  const stopInsights = useInsightsStore((s) => s.stopPolling)
  const fetchJobDetail = useClusterStore((s) => s.fetchJobDetail)
  const jobDetail = useClusterStore((s) => s.jobDetail)

  const runningJobs = useClusterStore((s) => s.runningJobs)
  const scores = useInsightsStore((s) => s.bottleneckScores)
  const recommendations = useInsightsStore((s) => s.recommendations)

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  useEffect(() => {
    initCluster()
    startCluster()
    initInsights()
    startInsights()
    return () => {
      stopInsights()
      stopCluster()
    }
  }, [
    initCluster,
    startCluster,
    stopCluster,
    initInsights,
    startInsights,
    stopInsights,
  ])

  // Auto-select the highest-pressure job by default
  useEffect(() => {
    if (!selectedJobId && scores.length > 0) {
      const top = scores.reduce(
        (worst, s) => (s.score > (worst?.score ?? 0) ? s : worst),
        scores[0],
      )
      setSelectedJobId(top.jobId)
    }
  }, [scores, selectedJobId])

  useEffect(() => {
    if (selectedJobId) {
      fetchJobDetail(selectedJobId).catch(() => {
        /* surfaced via cluster-store fetchError */
      })
    }
  }, [selectedJobId, fetchJobDetail])

  const topHot = useMemo(
    () => [...scores].sort((a, b) => b.score - a.score).slice(0, 6),
    [scores],
  )
  const selectedJobName = useMemo(
    () => runningJobs.find((j) => j.id === selectedJobId)?.name ?? null,
    [runningJobs, selectedJobId],
  )
  const heatmapJob =
    jobDetail && jobDetail.id === selectedJobId ? jobDetail : null

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Observe" }, { label: "Bottlenecks" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Bottleneck analyzer
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {scores.length} vertices analyzed · {recommendations.length}{" "}
            recommendation{recommendations.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-12 gap-5 mb-6">
        {/* Top hot operators */}
        <div className="col-span-12 lg:col-span-7">
          <div className="glass-card-static p-5">
            <h3 className="font-sans text-[14px] font-medium text-zinc-100 mb-3">
              Top hot operators
            </h3>
            {topHot.length === 0 ? (
              <p className="text-[12px] text-fg-muted text-center py-6">
                No bottleneck data yet — analyzer waits for the first job detail
                fetch.
              </p>
            ) : (
              <div className="space-y-3">
                {topHot.map((s) => {
                  const tone = severityColor(s.score)
                  return (
                    <button
                      key={`${s.jobId}-${s.vertexId}`}
                      type="button"
                      onClick={() => setSelectedJobId(s.jobId)}
                      className="w-full text-left"
                    >
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className={`font-mono ${tone.text} truncate`}>
                          {s.jobName} / {s.vertexName}
                        </span>
                        <span className={`font-mono ${tone.text}`}>
                          {Math.round(s.score)}%
                        </span>
                      </div>
                      <div className="resource-bar">
                        <div
                          className="seg"
                          style={{
                            width: `${Math.min(100, s.score)}%`,
                            background: tone.bar,
                          }}
                        />
                        <div
                          className="seg free"
                          style={{
                            width: `${Math.max(0, 100 - s.score)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-fg-faint">
                        bp {Math.round(s.factors.backpressure)}% · busy{" "}
                        {Math.round(s.factors.busyTime)}% · skew{" "}
                        {Math.round(s.factors.skew)}%
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="col-span-12 lg:col-span-5">
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Recommendations</h3>
            {recommendations.length === 0 ? (
              <p className="text-[11px] font-mono text-fg-faint">
                No actionable recommendations right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {recommendations.slice(0, 6).map((r, i) => (
                  <li
                    key={`${r.vertexId}-${i}`}
                    className="flex items-start gap-2 text-[12px]"
                  >
                    <Lightbulb className="text-fr-amber size-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <Link
                        to="/hub/jobs/$id"
                        params={{ id: r.jobId }}
                        className="text-fg hover:text-fr-coral leading-snug"
                      >
                        {r.message}
                      </Link>
                      <div className="font-mono text-[10px] text-fg-faint mt-0.5">
                        {r.jobName} / {r.vertexName}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="glass-card-static p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-sans text-[14px] font-medium text-zinc-100">
              {selectedJobName ?? "Select a job"} — subtask backpressure heatmap
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              click a hot operator above to switch jobs
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {runningJobs.slice(0, 6).map((j) => {
              const active = j.id === selectedJobId
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJobId(j.id)}
                  className={`prop-chip ${active ? "active" : ""}`}
                >
                  {j.name}
                </button>
              )
            })}
          </div>
        </div>

        <BottleneckHeatmap job={heatmapJob} />
      </section>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/insights/bottlenecks")({
  component: HubInsightsBottlenecks,
})
