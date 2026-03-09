import { lazy, Suspense, useCallback, useMemo, useState } from "react"
import { TapPanel } from "@/components/tap/tap-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FlinkJob } from "@/data/cluster-types"
import type { TapMetadata } from "@/data/tap-types"
import { useClusterStore } from "@/stores/cluster-store"
import { useSqlGatewayStore } from "@/stores/sql-gateway-store"
import { useTapStore } from "@/stores/tap-store"
import { CheckpointsTab } from "./detail/checkpoints-tab"
import { ConfigurationTab } from "./detail/configuration-tab"
import { DataSkewTab } from "./detail/data-skew-tab"
import { ExceptionsTab } from "./detail/exceptions-tab"
import { JobHeader } from "./detail/job-header"
import { TimelineTab } from "./detail/timeline-tab"
import { VerticesTab } from "./detail/vertices-tab"

// Lazy import for ReactFlow component (dagre uses CJS)
const JobGraph = lazy(() =>
  import("./detail/job-graph").then((m) => ({ default: m.JobGraph })),
)

function JobGraphFallback() {
  return (
    <div className="glass-card flex min-h-0 flex-1 items-center justify-center py-16 text-xs text-zinc-500">
      Loading graph...
    </div>
  )
}

export function JobDetail({
  job,
  onCancelJob,
  onCreateSavepoint,
}: {
  job: FlinkJob
  onCancelJob?: () => void
  onCreateSavepoint?: () => void
}) {
  const fetchJobDetail = useClusterStore((s) => s.fetchJobDetail)
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading)
  const [savepointFeedback, setSavepointFeedback] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>()

  const handleSelectVertex = (vertexId: string) => {
    setSelectedVertexId(vertexId)
    setActiveTab("vertices")
  }

  const handleSavepoint = () => {
    setSavepointFeedback(true)
    setTimeout(() => setSavepointFeedback(false), 2000)
    onCreateSavepoint?.()
  }

  // Job name — used as the pipeline name for tap manifest
  const jobName = job.name

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
        onRefresh={() => fetchJobDetail(job.id)}
        isRefreshing={jobDetailLoading}
      />

      {savepointFeedback && (
        <div className="rounded-md bg-fr-amber/10 px-3 py-2 text-xs text-fr-amber">
          Savepoint trigger sent. Check your savepoint directory for progress.
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
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
          </TabsTrigger>
          {!job.name.startsWith("flink-reactor-tap-") && (
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
            vertexNames={vertexNames}
          />
        </TabsContent>

        <TabsContent
          value="configuration"
          className="mt-4 flex-1 overflow-auto"
        >
          <ConfigurationTab configuration={job.configuration} />
        </TabsContent>

        {!job.name.startsWith("flink-reactor-tap-") && (
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
