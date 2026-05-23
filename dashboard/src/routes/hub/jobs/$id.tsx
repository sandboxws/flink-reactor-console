/**
 * Hub job detail — /hub/jobs/$id.
 *
 * Mirrors `console-v2/job.html` chrome (breadcrumb, title row, KPI strip,
 * tabs nav) and reuses the existing legacy tab content components for the
 * actual rendering. Re-styling each tab's interior is deferred to a follow-up
 * (specifically called out in the P2 spec as "tab content can keep legacy
 * styling for now; chrome must match the mockup").
 *
 * Layout: HubAppShell with NO right rail — the operator-detail panel lives
 * INSIDE main as a 4/12 column next to the DAG (matches mockup), not in the
 * global page-grid right rail.
 */

import {
  HubBreadcrumb,
  LiveDot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Clock,
  Droplets,
  FileCode2,
  GitBranch,
  Layers,
  ListTree,
  MoreHorizontal,
  Plug,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Waves,
} from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { JobKpiStrip } from "@/components/hub/jobs/job-kpi-strip"
import { CheckpointsTab } from "@/components/jobs/detail/checkpoints-tab"
import { ConfigurationTab } from "@/components/jobs/detail/configuration-tab"
import { ExceptionsTab } from "@/components/jobs/detail/exceptions-tab"
import { extractSql } from "@/components/jobs/detail/sql-tab"
import { TimelineTab } from "@/components/jobs/detail/timeline-tab"
import { VerticesTab } from "@/components/jobs/detail/vertices-tab"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"
import { useTapStore } from "@/stores/tap-store"

/** Lazy-loaded DAG — keeps ReactFlow + xyflow CSS out of the initial chunk. */
const HubJobGraph = lazy(() =>
  import("@/components/hub/jobs/hub-job-graph").then((m) => ({
    default: m.HubJobGraph,
  })),
)

/** Lazy-loaded SQL tab — keeps CodeMirror + lang-sql out of the initial chunk. */
const HubSqlTab = lazy(() =>
  import("@/components/hub/jobs/tabs/sql-tab").then((m) => ({
    default: m.HubSqlTab,
  })),
)

const HubDataSkewTab = lazy(() =>
  import("@/components/hub/jobs/tabs/data-skew-tab").then((m) => ({
    default: m.HubDataSkewTab,
  })),
)

const HubSourcesSinksTab = lazy(() =>
  import("@/components/hub/jobs/tabs/sources-sinks-tab").then((m) => ({
    default: m.HubSourcesSinksTab,
  })),
)

const HubWatermarksTab = lazy(() =>
  import("@/components/hub/jobs/tabs/watermarks-tab").then((m) => ({
    default: m.HubWatermarksTab,
  })),
)

/** Lazy-loaded Tap tab — pulls in the full streaming-SQL panel only when opened. */
const HubTapTab = lazy(() =>
  import("@/components/hub/jobs/tabs/tap-tab").then((m) => ({
    default: m.HubTapTab,
  })),
)

function TabFallback() {
  return (
    <div className="glass-card-static py-12 text-center text-[12px] font-mono text-fg-muted">
      Loading…
    </div>
  )
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function HubJobDetail() {
  const { id } = useParams({ from: "/hub/jobs/$id" })
  const fetchJobDetail = useClusterStore((s) => s.fetchJobDetail)
  const clearJobDetail = useClusterStore((s) => s.clearJobDetail)
  const jobDetail = useClusterStore((s) => s.jobDetail)
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading)
  const jobDetailError = useClusterStore((s) => s.jobDetailError)
  const cancelJob = useClusterStore((s) => s.cancelJob)
  const triggerSavepoint = useClusterStore((s) => s.triggerSavepoint)
  const stopWithSavepoint = useClusterStore((s) => s.stopWithSavepoint)

  const [activeTab, setActiveTab] = useState("dag")
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>()

  const loadTapManifest = useTapStore((s) => s.loadManifest)
  const tapPipelineName = useTapStore((s) => s.currentPipelineName)
  const tapOperators = useTapStore((s) => s.availableOperators)

  useEffect(() => {
    fetchJobDetail(id)
    return () => clearJobDetail()
  }, [id, fetchJobDetail, clearJobDetail])

  const job = jobDetail

  /**
   * Reactively load the tap manifest by job name. The Tap tab visibility
   * derives from `tapPipelineName === job.name && tapOperators.length > 0`;
   * a missing manifest is a 404 inside the store and silently produces an
   * empty list, so this never fails the route.
   */
  useEffect(() => {
    if (!job?.name) return
    if (tapPipelineName !== job.name) {
      loadTapManifest(job.name)
    }
  }, [job?.name, tapPipelineName, loadTapManifest])
  const isRunning = job
    ? ["RUNNING", "CREATED", "RESTARTING", "RECONCILING"].includes(job.status)
    : false
  const vertexNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of job?.plan?.vertices ?? []) map[v.id] = v.name
    return map
  }, [job?.plan])

  const hasSql = useMemo(
    () => extractSql(job?.jobConfig?.userConfig) !== null,
    [job?.jobConfig],
  )
  const hasTapManifest =
    !!job && tapPipelineName === job.name && tapOperators.length > 0
  const hasSourcesSinks = (job?.sourcesAndSinks.length ?? 0) > 0

  /**
   * Snap back to DAG if the active tab becomes unavailable (e.g. user lands on
   * /tap and switches to a job without a manifest). Radix Tabs leave the active
   * value alone otherwise, which would render an empty panel.
   */
  useEffect(() => {
    if (activeTab === "sql" && !hasSql) setActiveTab("dag")
    if (activeTab === "tap" && !hasTapManifest) setActiveTab("dag")
    if (activeTab === "sources-sinks" && !hasSourcesSinks) setActiveTab("dag")
  }, [activeTab, hasSql, hasTapManifest, hasSourcesSinks])

  const handleSelectVertex = (vertexId: string) => {
    setSelectedVertexId(vertexId)
    setActiveTab("vertices")
  }

  if (jobDetailLoading && !job) {
    return (
      <HubAppShell>
        <div className="flex h-64 items-center justify-center text-[12px] font-mono text-fg-muted">
          Loading job detail…
        </div>
      </HubAppShell>
    )
  }

  if (jobDetailError || !job) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Pipelines", to: "/hub/jobs/running" },
            { label: id, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="mt-6 glass-card-static p-6 text-center">
          <AlertTriangle className="mx-auto size-6 text-fr-rose" />
          <h2 className="mt-3 text-[14px] font-medium text-zinc-100">
            {jobDetailError ? "Failed to load job" : "Job not found"}
          </h2>
          <p className="mt-1 text-[12px] text-fg-muted">
            {jobDetailError ?? `No job with ID ${id}.`}
          </p>
        </div>
      </HubAppShell>
    )
  }

  const statusClass =
    job.status === "RUNNING"
      ? "running"
      : job.status === "FINISHED"
        ? "finished"
        : job.status === "FAILED"
          ? "failed"
          : "cancelled"

  return (
    <HubAppShell>
      {/* ── Page header ─────────────────────────────────────────── */}
      <HubBreadcrumb
        crumbs={[
          { label: "Pipelines", to: "/hub/jobs/running" },
          { label: id.slice(0, 8), mono: true },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Layers className="size-6 text-fr-coral shrink-0" />
            <h1 className="font-sans text-[26px] font-semibold tracking-tight text-zinc-100 truncate">
              {job.name}
            </h1>
            <span className={`status-pill ${statusClass} shrink-0`}>
              {isRunning ? <LiveDot /> : null}
              {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-fg-muted">
            <span className="font-mono">{job.id}</span>
            <span className="text-fg-faint">·</span>
            <span>started {timeAgo(job.startTime)}</span>
            {job.duration > 0 ? (
              <>
                <span className="text-fg-faint">·</span>
                <span>{Math.round(job.duration / 1000 / 60)}m runtime</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => triggerSavepoint(job.id)}
              >
                <Bookmark />
                Savepoint
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => stopWithSavepoint(job.id)}
              >
                <RotateCcw />
                Stop with savepoint
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => cancelJob(job.id)}
                style={{
                  borderColor: "rgba(234,105,98,0.4)",
                  color: "var(--color-fr-rose)",
                }}
              >
                <Square />
                Cancel
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="More actions"
          >
            <MoreHorizontal />
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <JobKpiStrip job={job} />

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6 flex flex-col"
      >
        <TabsList className="flex w-full items-center gap-1 border-b border-dash-border overflow-x-auto -mb-px bg-transparent p-0">
          <TabsTrigger value="dag" className="tab">
            <GitBranch />
            <span>DAG</span>
          </TabsTrigger>
          {hasSql ? (
            <TabsTrigger value="sql" className="tab">
              <FileCode2 />
              <span>SQL</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="vertices" className="tab">
            <ListTree />
            <span>Vertices</span>
          </TabsTrigger>
          {hasSourcesSinks ? (
            <TabsTrigger value="sources-sinks" className="tab">
              <Plug />
              <span>Sources &amp; Sinks</span>
              <span className="tab-count">{job.sourcesAndSinks.length}</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="checkpoints" className="tab">
            <BarChart3 />
            <span>Checkpoints</span>
            {job.checkpointCounts?.completed ? (
              <span className="tab-count">
                {job.checkpointCounts.completed}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="data-skew" className="tab">
            <Waves />
            <span>Data Skew</span>
          </TabsTrigger>
          <TabsTrigger value="watermarks" className="tab">
            <Droplets />
            <span>Watermarks</span>
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="tab">
            <AlertTriangle />
            <span>Exceptions</span>
            {job.exceptions.length > 0 ? (
              <span className="tab-count">{job.exceptions.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="config" className="tab">
            <SlidersHorizontal />
            <span>Config</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="tab">
            <Clock />
            <span>Timeline</span>
          </TabsTrigger>
          {hasTapManifest ? (
            <TabsTrigger value="tap" className="tab">
              <Radio />
              <span>Tap</span>
              <span className="tab-count">{tapOperators.length}</span>
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* DAG tab */}
        <TabsContent value="dag" className="mt-6 outline-none">
          <div className="glass-card-static flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                  Operator DAG
                </h3>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {job.plan?.vertices.length ?? 0} vertices ·{" "}
                  {job.plan?.edges.length ?? 0} edges · click any operator for
                  detail · ReactFlow rendered
                </p>
              </div>
            </div>
            {job.plan ? (
              <Suspense
                fallback={
                  <div className="fr-dag-mount loading flex items-center justify-center text-[12px] font-mono text-fg-muted">
                    Loading graph…
                  </div>
                }
              >
                <HubJobGraph
                  plan={job.plan}
                  selectedVertexId={selectedVertexId}
                  onSelectVertex={handleSelectVertex}
                />
              </Suspense>
            ) : (
              <div className="py-16 text-center text-[12px] font-mono text-fg-muted">
                No execution plan available
              </div>
            )}
            {/* Legend below the canvas — matches console-v2/job.html */}
            {job.plan ? (
              <div className="mt-3 flex items-center justify-between border-t border-dash-border pt-3 font-mono text-[10px] text-fg-faint">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-coral" />
                    source
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-violet" />
                    operator
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-teal" />
                    shuffle
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-amber" />
                    sink
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>busy &lt; 300ms/s sage</span>
                  <span>300–600 amber ring</span>
                  <span>≥ 600 rose ring</span>
                  <span className="text-fg-faint">·</span>
                  <span>drag · scroll-zoom · ⇧-select</span>
                </div>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* SQL tab (conditional) */}
        {hasSql ? (
          <TabsContent value="sql" className="mt-6 outline-none">
            <Suspense fallback={<TabFallback />}>
              <HubSqlTab jobConfig={job.jobConfig} />
            </Suspense>
          </TabsContent>
        ) : null}

        {/* Vertices tab */}
        <TabsContent value="vertices" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <VerticesTab job={job} selectedVertexId={selectedVertexId} />
          </div>
        </TabsContent>

        {/* Sources & Sinks tab */}
        {hasSourcesSinks ? (
          <TabsContent value="sources-sinks" className="mt-6 outline-none">
            <Suspense fallback={<TabFallback />}>
              <HubSourcesSinksTab job={job} />
            </Suspense>
          </TabsContent>
        ) : null}

        {/* Checkpoints tab */}
        <TabsContent value="checkpoints" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <CheckpointsTab
              jobId={job.id}
              checkpoints={job.checkpoints}
              counts={job.checkpointCounts}
              config={job.checkpointConfig}
              checkpointLatest={job.checkpointLatest}
              vertexNames={vertexNames}
            />
          </div>
        </TabsContent>

        {/* Data Skew tab */}
        <TabsContent value="data-skew" className="mt-6 outline-none">
          <Suspense fallback={<TabFallback />}>
            <HubDataSkewTab job={job} />
          </Suspense>
        </TabsContent>

        {/* Exceptions tab */}
        <TabsContent value="exceptions" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <ExceptionsTab exceptions={job.exceptions} />
          </div>
        </TabsContent>

        {/* Config tab */}
        <TabsContent value="config" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <ConfigurationTab configuration={job.configuration} />
          </div>
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <TimelineTab
              vertices={job.plan?.vertices ?? []}
              jobStartTime={job.startTime}
            />
          </div>
        </TabsContent>

        {/* Watermarks tab */}
        <TabsContent value="watermarks" className="mt-6 outline-none">
          <Suspense fallback={<TabFallback />}>
            <HubWatermarksTab job={job} />
          </Suspense>
        </TabsContent>

        {/* Tap tab (conditional) */}
        {hasTapManifest ? (
          <TabsContent value="tap" className="mt-6 outline-none">
            <Suspense fallback={<TabFallback />}>
              <HubTapTab jobName={job.name} />
            </Suspense>
          </TabsContent>
        ) : null}
      </Tabs>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/jobs/$id")({
  component: HubJobDetail,
})
