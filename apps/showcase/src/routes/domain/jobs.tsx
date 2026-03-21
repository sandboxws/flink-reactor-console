import {
  CheckpointsTab,
  ConfigurationTab,
  DataSkewTab,
  ExceptionsTab,
  JobHeader,
  JobHistoryTable,
  JobsTable,
  SourceSinkCard,
  SourcesSinksTab,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimelineTab,
  VerticesTab,
} from "@flink-reactor/ui"
import {
  createCheckpointConfig,
  createCheckpointCounts,
  createConnector,
  createFlinkJob,
  createJobException,
} from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const job = createFlinkJob()
const completedJob = createFlinkJob({
  status: "FINISHED",
  endTime: new Date(),
  name: "analytics-daily-rollup",
  exceptions: [createJobException()],
})

const historyEntries = [
  {
    jid: "abc-001",
    cluster: "prod",
    name: "ecommerce-order-enrichment",
    state: "FINISHED",
    startTime: new Date(Date.now() - 7_200_000).toISOString(),
    endTime: new Date(Date.now() - 3_600_000).toISOString(),
    durationMs: 3_600_000,
  },
  {
    jid: "abc-002",
    cluster: "prod",
    name: "analytics-daily-rollup",
    state: "FAILED",
    startTime: new Date(Date.now() - 14_400_000).toISOString(),
    endTime: new Date(Date.now() - 10_800_000).toISOString(),
    durationMs: 3_600_000,
  },
]

const jobsTableProps: PropDef[] = [
  {
    name: "mode",
    type: '"running" | "completed"',
    description: "Toggle between running and completed job columns",
  },
  {
    name: "jobs",
    type: "FlinkJob[]",
    description: "Array of Flink job objects to display",
  },
  {
    name: "tappablePipelines",
    type: "Set<string>",
    default: "undefined",
    description: "Set of pipeline names that show a tap icon",
  },
  {
    name: "onJobClick",
    type: "(jobId: string) => void",
    default: "undefined",
    description: "Called when a job row is clicked",
  },
  {
    name: "onCancelJob",
    type: "(jobId: string) => void",
    default: "undefined",
    description: "Called when the cancel button is clicked (running mode)",
  },
]

const jobHeaderProps: PropDef[] = [
  { name: "job", type: "FlinkJob", description: "Full Flink job object" },
  {
    name: "featureFlags",
    type: "FlinkFeatureFlags | null",
    default: "undefined",
    description: "Cluster feature flags controlling cancel/savepoint buttons",
  },
  {
    name: "onBack",
    type: "() => void",
    default: "undefined",
    description: "Back navigation callback",
  },
  {
    name: "onCancelJob",
    type: "() => void",
    default: "undefined",
    description: "Cancel job callback",
  },
]

const TOC = [
  { id: "tables", label: "Tables" },
  { id: "graph-nodes", label: "Graph Nodes" },
  { id: "detail-tabs", label: "Detail Tabs" },
]

function JobsDomainPage() {
  return (
    <ShowcasePage
      title="Jobs"
      description="Job tables, graphs, and detail tabs. 13 components."
      items={TOC}
    >
      <Tabs defaultValue="tables">
        <TabsList>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="graph-nodes">Graph Nodes</TabsTrigger>
          <TabsTrigger value="detail-tabs">Detail Tabs</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="mt-6 flex flex-col gap-8">
          <Section
            id="tables"
            title="JobsTable"
            description="Sortable table of running or completed Flink jobs with copy-to-clipboard IDs and cancel actions."
          >
            <div className="glass-card overflow-hidden">
              <JobsTable
                mode="running"
                jobs={[job]}
                onJobClick={(_id) => {}}
                onCancelJob={(_id) => {}}
              />
            </div>
            <div className="mt-4">
              <PropsTable props={jobsTableProps} />
            </div>
          </Section>

          <Section
            id="job-history-table"
            title="JobHistoryTable"
            description="Paginated table for historical job entries with server-side sort support."
          >
            <div className="glass-card overflow-hidden">
              <JobHistoryTable
                entries={historyEntries}
                totalCount={historyEntries.length}
                hasNextPage={false}
                currentPage={0}
                pageSize={20}
                orderField="START_TIME"
                orderDirection="DESC"
                onSort={() => {}}
                onNextPage={() => {}}
                onPrevPage={() => {}}
                onJobClick={(_id) => {}}
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="graph-nodes" className="mt-6 flex flex-col gap-8">
          <Section
            id="graph-nodes"
            title="Graph Node Components"
            description="OperatorNode, StrategyEdge, and SourceSinkCard are used within the job graph (ReactFlow)."
          >
            <div className="glass-card p-4">
              <p className="text-sm text-fg-muted mb-4">
                <strong>OperatorNode</strong> and <strong>StrategyEdge</strong>{" "}
                are custom @xyflow/react node and edge types. They cannot be
                rendered standalone outside a ReactFlow context. They are used
                within the Job Graph DAG to display vertex metrics, task bars,
                and ship strategy labels on edges.
              </p>
              <p className="text-sm text-fg-muted mb-4">
                <strong>SourceSinkCard</strong> can be rendered standalone and
                shows connector metadata:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SourceSinkCard connector={createConnector()} />
                <SourceSinkCard
                  connector={createConnector({
                    vertexId: "vertex-3",
                    vertexName: "Sink: Iceberg [order_summary]",
                    connectorType: "iceberg",
                    role: "sink",
                    resource: "order_summary",
                    metrics: {
                      recordsRead: 0,
                      recordsWritten: 480_000,
                      bytesRead: 0,
                      bytesWritten: 190_000_000,
                    },
                  })}
                />
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="detail-tabs" className="mt-6 flex flex-col gap-8">
          <Section
            id="detail-tabs"
            title="JobHeader"
            description="Rich job header with status badge, live duration, metadata grid, and action buttons."
          >
            <JobHeader
              job={job}
              onBack={() => {}}
              onCancelJob={() => {}}
              onCreateSavepoint={() => {}}
              onStopWithSavepoint={() => {}}
              onRefresh={() => {}}
            />
            <div className="mt-4">
              <PropsTable props={jobHeaderProps} />
            </div>
          </Section>

          <Section
            id="sources-sinks-tab"
            title="SourcesSinksTab"
            description="Grouped display of detected source and sink connectors for a job."
          >
            <SourcesSinksTab sourcesAndSinks={job.sourcesAndSinks} />
          </Section>

          <Section
            id="checkpoints-tab"
            title="CheckpointsTab"
            description="Checkpoint history with detail drill-down, config summary, and sparkline chart."
          >
            <CheckpointsTab
              jobId={job.id}
              checkpoints={job.checkpoints}
              counts={createCheckpointCounts()}
              config={createCheckpointConfig()}
              fetchCheckpointDetail={async () => null}
              fetchCheckpointSubtaskDetail={async () => []}
            />
          </Section>

          <Section
            id="configuration-tab"
            title="ConfigurationTab"
            description="Grouped, searchable Flink configuration key-value browser."
          >
            <ConfigurationTab configuration={job.configuration} />
          </Section>

          <Section
            id="exceptions-tab"
            title="ExceptionsTab"
            description="Root cause and exception history with collapsible stack traces."
          >
            <ExceptionsTab exceptions={completedJob.exceptions} />
          </Section>

          <Section
            id="vertices-tab"
            title="VerticesTab"
            description="Per-vertex detail with subtask table, watermarks, backpressure, and metrics charts."
          >
            <VerticesTab job={job} />
          </Section>

          <Section
            id="data-skew-tab"
            title="DataSkewTab"
            description="Bar chart comparing subtask record distribution to detect data skew."
          >
            <DataSkewTab
              subtaskMetrics={job.subtaskMetrics}
              vertices={job.plan?.vertices ?? []}
            />
          </Section>

          <Section
            id="timeline-tab"
            title="TimelineTab"
            description="Gantt chart showing vertex execution timeline with zoom controls."
          >
            <TimelineTab
              vertices={job.plan?.vertices ?? []}
              jobStartTime={job.startTime}
            />
          </Section>
        </TabsContent>
      </Tabs>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/jobs")({
  component: JobsDomainPage,
})
