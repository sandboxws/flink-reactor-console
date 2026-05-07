/**
 * Hub metrics explorer — /hub/insights/metrics.
 *
 * Mirrors `console-v2/metrics.html`: query bar (job + metric chips + run),
 * Recharts main canvas, four small thumbnail charts, and a metric catalog
 * grid with sparkline thumbnails. Uses procedural seeded data until the
 * `metricSeries` GraphQL endpoint lands — the catalog is a curated subset
 * of `METRIC_DEFINITIONS` from the alerts store, since both pages will
 * eventually share the same metric registry.
 */

import { HubBreadcrumb, PropChip } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Calendar, Play, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  type MetricCatalogEntry,
  MetricCatalogGrid,
} from "@/components/hub/insights/metric-catalog-grid"
import {
  type MetricPoint,
  MetricsCanvas,
} from "@/components/hub/insights/metrics-canvas"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

type Range = "1h" | "6h" | "24h"

const RANGE_MINUTES: Record<Range, number> = {
  "1h": 60,
  "6h": 360,
  "24h": 1440,
}

const CATALOG_BASE: Array<Omit<MetricCatalogEntry, "spark">> = [
  {
    id: "numRecordsOutPerSecond",
    label: "numRecordsOutPerSecond",
    group: "operator",
  },
  {
    id: "numRecordsInPerSecond",
    label: "numRecordsInPerSecond",
    group: "operator",
  },
  {
    id: "currentInputWatermark",
    label: "currentInputWatermark",
    group: "operator",
  },
  {
    id: "backPressureTimeMsPerSec",
    label: "backPressureTimeMsPerSec",
    group: "operator",
  },
  {
    id: "checkpointDuration",
    label: "checkpointDuration",
    group: "checkpointing",
  },
  {
    id: "checkpointSize",
    label: "checkpointSize",
    group: "checkpointing",
  },
  {
    id: "jvmHeapUsed",
    label: "jvm.heap.used",
    group: "taskmanager",
  },
  {
    id: "gcTime",
    label: "jvm.gc.time",
    group: "taskmanager",
  },
]

function seededSeries(
  metric: string,
  range: Range,
  jobName: string | null,
): MetricPoint[] {
  const minutes = RANGE_MINUTES[range]
  const points = 60
  const stepMs = (minutes * 60_000) / points
  const seed = hashString(`${metric}|${jobName ?? "_"}|${range}`)
  const base = (seed % 100) / 100
  const trend = (seed >> 5) % 5
  const rng = (n: number) => {
    const x = Math.sin((seed + n) * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const t = now - stepMs * (points - i - 1)
    const noise = rng(i) - 0.5
    const wave = Math.sin((i / points) * Math.PI * 2) * 0.3
    const drift = (i / points) * (trend - 2) * 0.4
    const v = Math.max(0, base + wave + drift + noise * 0.2)
    return { t, v: round3(v * 5_000_000) }
  })
}

function buildSparkline(metric: string): number[] {
  const seed = hashString(metric)
  return Array.from({ length: 12 }, (_, i) => {
    const x = Math.sin((seed + i) * 7.13) * 10000
    return x - Math.floor(x)
  })
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
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

  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string>(
    "numRecordsOutPerSecond",
  )
  const [range, setRange] = useState<Range>("1h")

  useEffect(() => {
    initCluster()
    startCluster()
    return () => stopCluster()
  }, [initCluster, startCluster, stopCluster])

  useEffect(() => {
    if (!selectedJob && runningJobs.length > 0) {
      setSelectedJob(runningJobs[0].id)
    }
  }, [runningJobs, selectedJob])

  const jobName = useMemo(
    () => runningJobs.find((j) => j.id === selectedJob)?.name ?? null,
    [runningJobs, selectedJob],
  )

  const series = useMemo(
    () => seededSeries(selectedMetric, range, jobName),
    [selectedMetric, range, jobName],
  )
  const last = series[series.length - 1]?.v ?? 0
  const first = series[0]?.v ?? 0
  const delta = first === 0 ? 0 : ((last - first) / first) * 100

  const catalog: MetricCatalogEntry[] = useMemo(
    () =>
      CATALOG_BASE.map((m) => ({
        ...m,
        spark: buildSparkline(m.id),
      })),
    [],
  )

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
            {runningJobs.length === 1 ? "" : "s"} · seeded series until{" "}
            <code className="font-mono">metricSeries</code> wires up
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
          <PropChip active>metric: {selectedMetric}</PropChip>
          <PropChip>aggregation: sum</PropChip>
          <button type="button" className="prop-chip text-fg-faint" disabled>
            <Plus className="size-3" />
            Add filter
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setRange((r) => (r === "1h" ? "6h" : r === "6h" ? "24h" : "1h"))
              }
            >
              <Calendar />
              Last {range}
            </button>
            <button type="button" className="btn btn-primary btn-sm">
              <Play />
              Run
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="glass-card-static p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                  {selectedMetric} — {jobName ?? "all jobs"}
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
            <MetricsCanvas data={series} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(
              [
                "currentInputWatermark",
                "backPressureTimeMsPerSec",
                "checkpointDuration",
                "gcTime",
              ] as const
            ).map((m) => {
              const data = seededSeries(m, range, jobName)
              return (
                <div key={m} className="glass-card-static p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] text-zinc-100 truncate">{m}</h3>
                    <span className="font-mono text-[14px] text-fg">
                      {compactCount(data[data.length - 1]?.v ?? 0)}
                    </span>
                  </div>
                  <MetricsCanvas
                    data={data}
                    color={
                      m === "checkpointDuration"
                        ? "var(--color-fr-amber)"
                        : m === "gcTime"
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
              entries={catalog}
              selectedId={selectedMetric}
              onSelect={setSelectedMetric}
            />
          </div>
        </aside>
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/insights/metrics")({
  component: HubInsightsMetrics,
})
