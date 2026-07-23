/**
 * @module job-detail
 *
 * Full-page container for a single Flink job, rendered when navigating to
 * `/jobs/:id`. Provides a tabbed interface (overview DAG, vertices, exceptions,
 * data skew, timeline, checkpoints, sources/sinks, configuration) with an
 * optional Tap tab for live observation of running pipelines.
 *
 * The overview tab lazy-loads {@link JobGraph} (which depends on dagre/CJS)
 * to keep the initial bundle small.
 *
 * Subscribes to {@link useClusterStore}, {@link useTapStore}, and
 * {@link useSqlGatewayStore} for job actions and tap session state.
 */

import type { FlinkJob, TapMetadata } from "@flink-reactor/ui"
import {
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { TapPanel } from "@/components/tap/tap-panel"
import { cn } from "@/lib/cn"
import { hasTapManifest } from "@/lib/tap-manifest"
import { useClusterStore } from "@/stores/cluster-store"
import { useSqlGatewayStore } from "@/stores/sql-gateway-store"
import { useTapStore } from "@/stores/tap-store"
import { CheckpointsTab } from "./detail/checkpoints-tab"
import { ConfigurationTab } from "./detail/configuration-tab"
import { DataSkewTab } from "./detail/data-skew-tab"
import { ExceptionsTab } from "./detail/exceptions-tab"
import { JobHeader } from "./detail/job-header"
import { RescalesTab } from "./detail/rescales-tab"
import { SourcesSinksTab } from "./detail/sources-sinks-tab"
import { SqlTab } from "./detail/sql-tab"
import { TimelineTab } from "./detail/timeline-tab"
import { VerticesTab } from "./detail/vertices-tab"

/**
 * Lazy-loaded DAG visualization. Deferred because dagre ships as CJS and
 * would otherwise block the initial chunk.
 */
const JobGraph = lazy(() =>
  import("./detail/job-graph").then((m) => ({ default: m.JobGraph })),
)

/** Placeholder shown while the lazy-loaded {@link JobGraph} chunk is fetched. */
function JobGraphFallback() {
  return (
    <div className="glass-card flex min-h-0 flex-1 items-center justify-center py-16 text-xs text-zinc-500">
      Loading graph...
    </div>
  )
}

/**
 * Full job detail page with header actions and a multi-tab content area.
 *
 * Manages tab state locally. The Tap tab is conditionally shown only for
 * running pipelines that have a tap manifest. Clicking a DAG node in the
 * overview tab programmatically switches to the vertices tab with that
 * vertex pre-selected.
 */
export function JobDetail({
  job,
  onCancelJob,
  onCreateSavepoint,
}: {
  /** Fully-hydrated job including plan, vertices, checkpoints, and exceptions. */
  job: FlinkJob
  /** Callback invoked when the user cancels the job via the header. */
  onCancelJob?: () => void
  /** Callback invoked after a savepoint trigger is sent. */
  onCreateSavepoint?: () => void
}) {
  const fetchJobDetail = useClusterStore((s) => s.fetchJobDetail)
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading)
  const savepointOp = useClusterStore((s) => s.savepointOp)
  const dismissSavepointOp = useClusterStore((s) => s.dismissSavepointOp)
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>()

  const handleSelectVertex = (vertexId: string) => {
    setSelectedVertexId(vertexId)
    setActiveTab("vertices")
  }

  const triggerSavepoint = useClusterStore((s) => s.triggerSavepoint)
  const stopWithSavepoint = useClusterStore((s) => s.stopWithSavepoint)

  // Rescales tab is gated on the cluster's RESCALE_HISTORY capability
  // (AdaptiveScheduler rescale history REST is Flink 2.3+, FLIP-495).
  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const hasRescaleHistory = (capabilities ?? []).includes("RESCALE_HISTORY")

  const handleStopWithSavepoint = async () => {
    await stopWithSavepoint(job.id)
  }

  const handleSavepoint = async () => {
    await triggerSavepoint(job.id)
    onCreateSavepoint?.()
  }

  // Job name — used as the pipeline name for tap manifest
  const jobName = job.name

  // Tap tab visibility: only for running jobs with a manifest
  const isRunning = [
    "RUNNING",
    "CREATED",
    "RESTARTING",
    "RECONCILING",
  ].includes(job.status)
  const isTapEligible = isRunning && !job.name.startsWith("fr-tap-")
  const [tapAvailable, setTapAvailable] = useState(false)

  useEffect(() => {
    if (!isTapEligible) {
      setTapAvailable(false)
      return
    }
    let cancelled = false
    hasTapManifest(jobName).then((exists) => {
      if (!cancelled) setTapAvailable(exists)
    })
    return () => {
      cancelled = true
    }
  }, [jobName, isTapEligible])

  // Build vertex ID → operator name map for checkpoint detail
  const vertexNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of job.plan?.vertices ?? []) {
      map[v.id] = v.name
    }
    return map
  }, [job.plan])

  // Tap integration — build maps for DAG node tap indicators
  const availableOperators = useTapStore((s) => s.availableOperators)
  const tapSessions = useSqlGatewayStore((s) => s.sessions)

  const tapMetadataByVertex = useMemo(() => {
    const map = new Map<string, TapMetadata>()
    for (const op of availableOperators) {
      map.set(op.name, op)
    }
    return map
  }, [availableOperators])

  const tapSessionStatuses = useMemo(() => {
    const statuses: Record<string, (typeof tapSessions)[string]["status"]> = {}
    for (const session of Object.values(tapSessions)) {
      statuses[session.tapNodeId] = session.status
    }
    return statuses
  }, [tapSessions])

  const handleTapInto = useCallback(
    (vertexName: string) => {
      const metadata = tapMetadataByVertex.get(vertexName)
      if (!metadata) return
      useTapStore.getState().openTab(metadata.nodeId)
      setActiveTab("tap")
    },
    [tapMetadataByVertex],
  )

  const handleStopTap = useCallback(
    (vertexName: string) => {
      const metadata = tapMetadataByVertex.get(vertexName)
      if (!metadata) return
      useSqlGatewayStore.getState().stopTap(metadata.nodeId)
      useTapStore.getState().closeTab(metadata.nodeId)
    },
    [tapMetadataByVertex],
  )

  return (
    <div className="flex h-[calc(100vh-2.75rem)] flex-col gap-4 p-4">
      <JobHeader
        job={job}
        onCancelJob={onCancelJob}
        onCreateSavepoint={handleSavepoint}
        onStopWithSavepoint={handleStopWithSavepoint}
        onRefresh={() => fetchJobDetail(job.id)}
        isRefreshing={jobDetailLoading}
      />

      {savepointOp && savepointOp.jobId === job.id && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
            savepointOp.status === "IN_PROGRESS" &&
              "bg-fr-amber/10 text-fr-amber",
            savepointOp.status === "COMPLETED" &&
              "bg-job-finished/10 text-job-finished",
            savepointOp.status === "FAILED" &&
              "bg-job-failed/10 text-job-failed",
          )}
        >
          {savepointOp.status === "IN_PROGRESS" && (
            <>
              <Spinner size="sm" />
              <span>
                {savepointOp.kind === "stop-with-savepoint"
                  ? "Stopping job with savepoint…"
                  : "Savepoint in progress…"}
              </span>
            </>
          )}
          {savepointOp.status === "COMPLETED" && (
            <span className="min-w-0 flex-1 truncate">
              Savepoint completed
              {savepointOp.location && (
                <>
                  {": "}
                  <span
                    className="font-mono text-zinc-300"
                    title={savepointOp.location}
                  >
                    {savepointOp.location}
                  </span>
                </>
              )}
            </span>
          )}
          {savepointOp.status === "FAILED" && (
            <span className="min-w-0 flex-1 truncate">
              Savepoint failed
              {savepointOp.error ? `: ${savepointOp.error}` : ""}
            </span>
          )}
          {savepointOp.status !== "IN_PROGRESS" && (
            <button
              type="button"
              onClick={dismissSavepointOp}
              className="ml-auto shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="overview" className="detail-tab">
            Overview
          </TabsTrigger>
          <TabsTrigger value="sql" className="detail-tab">
            SQL
          </TabsTrigger>
          <TabsTrigger value="vertices" className="detail-tab">
            Vertices
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="detail-tab">
            Exceptions
            {job.exceptions.length > 0 && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-job-failed/20 text-[10px] text-job-failed">
                {job.exceptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="data-skew" className="detail-tab">
            Data Skew
          </TabsTrigger>
          <TabsTrigger value="timeline" className="detail-tab">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="detail-tab">
            Checkpoints
          </TabsTrigger>
          {hasRescaleHistory && (
            <TabsTrigger value="rescales" className="detail-tab">
              Rescales
            </TabsTrigger>
          )}
          <TabsTrigger value="sources-sinks" className="detail-tab">
            Sources &amp; Sinks
            {job.sourcesAndSinks.length > 0 && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">
                {job.sourcesAndSinks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
          </TabsTrigger>
          {tapAvailable && (
            <TabsTrigger value="tap" className="detail-tab">
              Tap
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="overview"
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          {job.plan ? (
            <Suspense fallback={<JobGraphFallback />}>
              <JobGraph
                plan={job.plan}
                onSelectVertex={handleSelectVertex}
                tapMetadataByVertex={tapMetadataByVertex}
                tapSessionStatuses={tapSessionStatuses}
                onTapInto={handleTapInto}
                onStopTap={handleStopTap}
              />
            </Suspense>
          ) : (
            <div className="glass-card flex min-h-0 flex-1 items-center justify-center py-16 text-xs text-zinc-500">
              No execution plan available
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="sql"
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SqlTab jobConfig={job.jobConfig} />
        </TabsContent>

        <TabsContent value="vertices" className="mt-4 flex-1 overflow-auto">
          <VerticesTab job={job} selectedVertexId={selectedVertexId} />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4 flex-1 overflow-auto">
          <ExceptionsTab exceptions={job.exceptions} />
        </TabsContent>

        <TabsContent value="data-skew" className="mt-4 flex-1 overflow-auto">
          <DataSkewTab
            subtaskMetrics={job.subtaskMetrics}
            vertices={job.plan?.vertices ?? []}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 flex-1 overflow-auto">
          <TimelineTab
            vertices={job.plan?.vertices ?? []}
            jobStartTime={job.startTime}
          />
        </TabsContent>

        <TabsContent value="checkpoints" className="mt-4 flex-1 overflow-auto">
          <CheckpointsTab
            jobId={job.id}
            checkpoints={job.checkpoints}
            counts={job.checkpointCounts}
            config={job.checkpointConfig}
            checkpointLatest={job.checkpointLatest}
            summary={job.checkpointSummary}
            vertexNames={vertexNames}
            isJobActive={isRunning}
          />
        </TabsContent>

        {hasRescaleHistory && (
          <TabsContent value="rescales" className="mt-4 flex-1 overflow-auto">
            <RescalesTab jobId={job.id} />
          </TabsContent>
        )}

        <TabsContent
          value="sources-sinks"
          className="mt-4 flex-1 overflow-auto"
        >
          <SourcesSinksTab sourcesAndSinks={job.sourcesAndSinks} />
        </TabsContent>

        <TabsContent
          value="configuration"
          className="mt-4 flex-1 overflow-auto"
        >
          <ConfigurationTab
            configuration={job.configuration}
            jobConfig={job.jobConfig}
          />
        </TabsContent>

        {tapAvailable && (
          <TabsContent
            value="tap"
            className="mt-4 flex-1 overflow-auto data-[state=inactive]:hidden"
            forceMount
          >
            <TapPanel jobName={jobName} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
