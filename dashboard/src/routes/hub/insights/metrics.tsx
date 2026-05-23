/**
 * Hub metrics explorer — /hub/insights/metrics.
 *
 * Mirrors `console-v2/metrics.html`. Catalog grid + main chart canvas + four
 * thumbnail charts, all sourced from live `metricCatalog` + `metricSeries`.
 * The time-range chip drives the query window for every surface on the page.
 */

import { HubBreadcrumb, PropChip } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Calendar, Play, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  type MetricCatalogEntry as CatalogTileEntry,
  MetricCatalogGrid,
} from "@/components/hub/insights/metric-catalog-grid"
import {
  type MetricPoint,
  MetricsCanvas,
} from "@/components/hub/insights/metrics-canvas"
import {
  fetchMetricCatalog,
  fetchMetricSeries,
  type MetricCatalogEntry,
  type MetricTimeSeries,
} from "@/lib/graphql-api-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useConfigStore } from "@/stores/config-store"

type Range = "1h" | "6h" | "24h" | "7d"

const RANGE_MINUTES: Record<Range, number> = {
  "1h": 60,
  "6h": 360,
  "24h": 1440,
  "7d": 10_080,
}

const RANGE_ORDER: Range[] = ["1h", "6h", "24h", "7d"]

/** Pull a human-readable group label from a catalog entry's source/metricID. */
function groupOf(entry: MetricCatalogEntry): string {
  if (entry.sourceType.toLowerCase() === "taskmanager") return "taskmanager"
  if (entry.sourceType.toLowerCase() === "jobmanager") return "jobmanager"
  if (/^checkpoint/i.test(entry.metricID)) return "checkpointing"
  return "operator"
}

/** Stable display label for a catalog entry, trimmed to the last ID segment. */
function labelOf(entry: MetricCatalogEntry): string {
  const segments = entry.metricID.split(/\./)
  return segments[segments.length - 1] ?? entry.metricID
}

/** Distinct-by-metricID, preserving the first sourceType/sourceID seen.  */
function distinctByMetricID(
  catalog: MetricCatalogEntry[],
): MetricCatalogEntry[] {
  const seen = new Map<string, MetricCatalogEntry>()
  for (const e of catalog) {
    if (!seen.has(e.metricID)) seen.set(e.metricID, e)
  }
  return Array.from(seen.values())
}

/** Reduce a list of series into the merged time-series for the main chart. */
function mergeSeriesToPoints(series: MetricTimeSeries[]): MetricPoint[] {
  // Aggregate by capturedAt bucket; sum values across sources within the bucket.
  const buckets = new Map<number, number>()
  for (const s of series) {
    for (const p of s.points) {
      const t = Date.parse(p.capturedAt)
      if (!Number.isFinite(t)) continue
      buckets.set(t, (buckets.get(t) ?? 0) + p.value)
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ t, v }))
}

/** Reduce a series list to a 0..1-normalized sparkline for the catalog tile. */
function seriesToSparkline(series: MetricTimeSeries[]): number[] {
  const merged = mergeSeriesToPoints(series)
  if (merged.length === 0) return []
  const peak = Math.max(...merged.map((p) => p.v), 0)
  if (peak === 0) return merged.map(() => 0)
  return merged.map((p) => p.v / peak)
}

function compactCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function HubInsightsMetrics() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startCluster = useClusterStore((s) => s.startPolling)
  const stopCluster = useClusterStore((s) => s.stopPolling)
  const runningJobs = useClusterStore((s) => s.runningJobs)
  const config = useConfigStore((s) => s.config)
  const clusterID = config?.clusters?.[0] ?? null

  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [range, setRange] = useState<Range>("1h")
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [mainSeries, setMainSeries] = useState<MetricTimeSeries[]>([])
  const [thumbSeries, setThumbSeries] = useState<MetricTimeSeries[]>([])
  const [sparkSeries, setSparkSeries] = useState<MetricTimeSeries[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)

  useEffect(() => {
    initCluster()
    startCluster()
    return () => stopCluster()
  }, [initCluster, startCluster, stopCluster])

  // Fetch the live catalog whenever the active cluster changes.
  useEffect(() => {
    if (!clusterID) {
      setCatalog([])
      setCatalogLoading(false)
      return
    }
    let cancelled = false
    setCatalogLoading(true)
    fetchMetricCatalog(clusterID)
      .then((c) => {
        if (cancelled) return
        setCatalog(c)
        setCatalogError(null)
        setCatalogLoading(false)
        // Default-select the first operator-group metric, falling back to first.
        if (c.length > 0) {
          const preferred =
            c.find((e) => /numRecordsOutPerSecond$/i.test(e.metricID)) ?? c[0]
          setSelectedMetric((prev) => prev ?? preferred.metricID)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCatalogError(err instanceof Error ? err.message : String(err))
        setCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clusterID])

  useEffect(() => {
    if (!selectedJob && runningJobs.length > 0) {
      setSelectedJob(runningJobs[0].id)
    }
  }, [runningJobs, selectedJob])

  const jobName = useMemo(
    () => runningJobs.find((j) => j.id === selectedJob)?.name ?? null,
    [runningJobs, selectedJob],
  )

  // Catalog tiles for the right rail — one tile per distinct metricID.
  const catalogTiles: CatalogTileEntry[] = useMemo(() => {
    const distinct = distinctByMetricID(catalog)
    return distinct.map((e) => {
      const matching = sparkSeries.filter((s) => s.metricID === e.metricID)
      return {
        id: e.metricID,
        label: labelOf(e),
        group: groupOf(e),
        spark: seriesToSparkline(matching),
      }
    })
  }, [catalog, sparkSeries])

  // Thumbnail metrics — pick four representative kinds when present, fall
  // back to the first four distinct metricIDs that aren't the selected one.
  const thumbnailIDs: string[] = useMemo(() => {
    const distinct = distinctByMetricID(catalog).map((e) => e.metricID)
    const preferred = [
      /currentInputWatermark$/i,
      /backPressureTimeMsPerSec$/i,
      /checkpointDuration$/i,
      /gcTime$/i,
    ]
    const picks: string[] = []
    for (const re of preferred) {
      const found = distinct.find((id) => re.test(id))
      if (found) picks.push(found)
    }
    for (const id of distinct) {
      if (picks.length >= 4) break
      if (id === selectedMetric) continue
      if (picks.includes(id)) continue
      picks.push(id)
    }
    return picks.slice(0, 4)
  }, [catalog, selectedMetric])

  // Whenever range / selection / catalog change, fetch all series the page needs.
  useEffect(() => {
    if (!clusterID || catalog.length === 0) {
      setMainSeries([])
      setThumbSeries([])
      setSparkSeries([])
      return
    }

    let cancelled = false
    setSeriesLoading(true)

    const before = new Date()
    const minutes = RANGE_MINUTES[range]
    const after = new Date(before.getTime() - minutes * 60_000)
    const sparkAfter = new Date(before.getTime() - 60 * 60_000) // sparkline window 1h regardless of range

    const mainEntries =
      selectedMetric != null
        ? catalog.filter((e) => e.metricID === selectedMetric)
        : []
    const thumbEntries = catalog.filter((e) =>
      thumbnailIDs.includes(e.metricID),
    )
    const sparkEntries = distinctByMetricID(catalog)

    async function run() {
      try {
        const [main, thumbs, sparks] = await Promise.all([
          mainEntries.length > 0
            ? fetchMetricSeries({
                clusterID: clusterID as string,
                series: mainEntries.map((m) => ({
                  sourceType: m.sourceType,
                  sourceID: m.sourceID,
                  metricID: m.metricID,
                })),
                after: after.toISOString(),
                before: before.toISOString(),
                maxPoints: 200,
              })
            : Promise.resolve<MetricTimeSeries[]>([]),
          thumbEntries.length > 0
            ? fetchMetricSeries({
                clusterID: clusterID as string,
                series: thumbEntries.map((m) => ({
                  sourceType: m.sourceType,
                  sourceID: m.sourceID,
                  metricID: m.metricID,
                })),
                after: after.toISOString(),
                before: before.toISOString(),
                maxPoints: 200,
              })
            : Promise.resolve<MetricTimeSeries[]>([]),
          sparkEntries.length > 0
            ? fetchMetricSeries({
                clusterID: clusterID as string,
                series: sparkEntries.map((m) => ({
                  sourceType: m.sourceType,
                  sourceID: m.sourceID,
                  metricID: m.metricID,
                })),
                after: sparkAfter.toISOString(),
                before: before.toISOString(),
                maxPoints: 24 * sparkEntries.length,
              })
            : Promise.resolve<MetricTimeSeries[]>([]),
        ])
        if (cancelled) return
        setMainSeries(main)
        setThumbSeries(thumbs)
        setSparkSeries(sparks)
        setSeriesLoading(false)
      } catch (_) {
        if (cancelled) return
        setSeriesLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [clusterID, catalog, selectedMetric, range, thumbnailIDs])

  const mainPoints = useMemo(
    () => mergeSeriesToPoints(mainSeries),
    [mainSeries],
  )
  const last = mainPoints[mainPoints.length - 1]?.v ?? 0
  const first = mainPoints[0]?.v ?? 0
  const delta = first === 0 ? 0 : ((last - first) / first) * 100

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Observe" }, { label: "Metrics" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Metrics explorer
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {runningJobs.length} pipeline
            {runningJobs.length === 1 ? "" : "s"} ·{" "}
            {catalogLoading
              ? "loading catalog…"
              : catalog.length === 0
                ? "no metrics in storage yet"
                : `${distinctByMetricID(catalog).length} metrics in catalog`}
          </p>
        </div>
      </div>

      {/* Query bar */}
      <div className="glass-card-static p-4 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-fg-faint uppercase tracking-wider">
            Query
          </span>
          <PropChip active={selectedJob !== null}>
            job: {jobName ?? "any"}
          </PropChip>
          <PropChip active>metric: {selectedMetric ?? "—"}</PropChip>
          <PropChip>aggregation: sum</PropChip>
          <button type="button" className="prop-chip text-fg-faint" disabled>
            <Plus className="size-3" />
            Add filter
          </button>
          <div className="ml-auto flex items-center gap-1">
            {RANGE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`prop-chip ${range === r ? "active" : ""}`}
                aria-pressed={range === r}
              >
                <Calendar className="size-3" />
                {r}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-primary btn-sm ml-2"
              disabled={seriesLoading}
            >
              <Play />
              Run
            </button>
          </div>
        </div>
      </div>

      {catalogError ? (
        <div className="glass-card-static p-4 mb-5 text-[12px] text-fr-rose">
          Failed to load metric catalog: {catalogError}
        </div>
      ) : null}

      {!catalogLoading && catalog.length === 0 ? (
        <div className="glass-card-static p-10 text-center">
          <h3 className="font-sans text-[14px] font-medium text-zinc-100">
            No metrics yet
          </h3>
          <p className="mt-1 text-[12px] text-fg-muted">
            Start a job to collect data, or wait for the next sync cycle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            <div className="glass-card-static p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                    {selectedMetric ?? "—"} — {jobName ?? "all jobs"}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-fg-faint">
                    <span className="size-2 rounded-full bg-fr-sage" />
                    current {compactCount(last)}
                    <span className="text-fg-faint">·</span>
                    <span
                      className={delta >= 0 ? "text-fr-sage" : "text-fr-rose"}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <MetricsCanvas data={mainPoints} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {thumbnailIDs.map((id) => {
                const data = mergeSeriesToPoints(
                  thumbSeries.filter((s) => s.metricID === id),
                )
                return (
                  <div key={id} className="glass-card-static p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[12px] text-zinc-100 truncate">
                        {id}
                      </h3>
                      <span className="font-mono text-[14px] text-fg">
                        {compactCount(data[data.length - 1]?.v ?? 0)}
                      </span>
                    </div>
                    <MetricsCanvas
                      data={data}
                      color={
                        /checkpointDuration$/i.test(id)
                          ? "var(--color-fr-amber)"
                          : /gcTime$/i.test(id)
                            ? "var(--color-fr-coral)"
                            : "var(--color-fr-teal)"
                      }
                      height={80}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card-static p-5">
              <h3 className="section-heading mb-3">Pipelines</h3>
              <div className="space-y-1">
                {runningJobs.length === 0 ? (
                  <p className="text-[11px] font-mono text-fg-faint">
                    No running pipelines.
                  </p>
                ) : (
                  runningJobs.map((job) => {
                    const active = job.id === selectedJob
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJob(job.id)}
                        className={`file-tree-row w-full text-left ${active ? "active" : ""}`}
                      >
                        <span
                          className={`font-mono truncate ${active ? "text-fr-coral" : "text-fg"}`}
                        >
                          {job.name}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-fg-faint">
                          p{job.parallelism}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="glass-card-static p-5">
              <h3 className="section-heading mb-3">Metric catalog</h3>
              <MetricCatalogGrid
                entries={catalogTiles}
                selectedId={selectedMetric ?? ""}
                onSelect={setSelectedMetric}
              />
            </div>
          </aside>
        </div>
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/insights/metrics")({
  component: HubInsightsMetrics,
})
