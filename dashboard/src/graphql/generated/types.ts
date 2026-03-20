export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K]
}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never }
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never
    }
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown> }
}

export type AllocatedSlot = {
  __typename?: "AllocatedSlot"
  index: Scalars["Int"]["output"]
  jobId: Scalars["String"]["output"]
  resource: TaskManagerResourceProfile
}

export type BackPressureInfo = {
  __typename?: "BackPressureInfo"
  backpressureLevel: Scalars["String"]["output"]
  endTimestamp: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
  subtasks: Array<SubtaskBackPressure>
}

export type BlueGreenDeployment = {
  __typename?: "BlueGreenDeployment"
  abortGracePeriod: Maybe<Scalars["String"]["output"]>
  abortTimestamp: Maybe<Scalars["String"]["output"]>
  activeJobId: Maybe<Scalars["String"]["output"]>
  blueDeploymentName: Maybe<Scalars["String"]["output"]>
  deploymentDeletionDelay: Maybe<Scalars["String"]["output"]>
  deploymentReadyTimestamp: Maybe<Scalars["String"]["output"]>
  error: Maybe<Scalars["String"]["output"]>
  greenDeploymentName: Maybe<Scalars["String"]["output"]>
  jobStatus: Maybe<Scalars["String"]["output"]>
  lastReconciledTimestamp: Maybe<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  namespace: Scalars["String"]["output"]
  pendingJobId: Maybe<Scalars["String"]["output"]>
  state: BlueGreenState
}

export type BlueGreenState =
  | "ACTIVE_BLUE"
  | "ACTIVE_GREEN"
  | "INITIALIZING_BLUE"
  | "SAVEPOINTING_BLUE"
  | "SAVEPOINTING_GREEN"
  | "TRANSITIONING_TO_BLUE"
  | "TRANSITIONING_TO_GREEN"

export type CancelJobResult = {
  __typename?: "CancelJobResult"
  success: Scalars["Boolean"]["output"]
}

export type CatalogDatabase = {
  __typename?: "CatalogDatabase"
  name: Scalars["String"]["output"]
}

export type CatalogInfo = {
  __typename?: "CatalogInfo"
  name: Scalars["String"]["output"]
  source: Scalars["String"]["output"]
}

export type CatalogTable = {
  __typename?: "CatalogTable"
  name: Scalars["String"]["output"]
}

export type CheckpointConfig = {
  __typename?: "CheckpointConfig"
  externalizedDeleteOnCancellation: Scalars["Boolean"]["output"]
  externalizedEnabled: Scalars["Boolean"]["output"]
  interval: Scalars["String"]["output"]
  maxConcurrent: Scalars["Int"]["output"]
  minPause: Scalars["String"]["output"]
  mode: Scalars["String"]["output"]
  timeout: Scalars["String"]["output"]
  unalignedCheckpoints: Scalars["Boolean"]["output"]
}

export type CheckpointCounts = {
  __typename?: "CheckpointCounts"
  completed: Scalars["Int"]["output"]
  failed: Scalars["Int"]["output"]
  inProgress: Scalars["Int"]["output"]
  restored: Scalars["Int"]["output"]
  total: Scalars["Int"]["output"]
}

/** Connection type for paginated checkpoint history results. */
export type CheckpointHistoryConnection = {
  __typename?: "CheckpointHistoryConnection"
  /** List of checkpoint history edges. */
  edges: Array<CheckpointHistoryEdge>
  /** Pagination metadata. */
  pageInfo: CheckpointHistoryPageInfo
}

/** A single edge in the checkpoint history connection. */
export type CheckpointHistoryEdge = {
  __typename?: "CheckpointHistoryEdge"
  /** Opaque cursor for this edge. */
  cursor: Scalars["String"]["output"]
  /** The checkpoint record. */
  node: StoredCheckpoint
}

export type CheckpointHistoryEntry = {
  __typename?: "CheckpointHistoryEntry"
  checkpointedSize: Maybe<Scalars["String"]["output"]>
  endToEndDuration: Scalars["String"]["output"]
  id: Scalars["String"]["output"]
  isSavepoint: Scalars["Boolean"]["output"]
  latestAckTimestamp: Scalars["String"]["output"]
  numAcknowledgedSubtasks: Scalars["Int"]["output"]
  numSubtasks: Scalars["Int"]["output"]
  persistedData: Scalars["String"]["output"]
  processedData: Scalars["String"]["output"]
  stateSize: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
  triggerTimestamp: Scalars["String"]["output"]
}

/** Filter criteria for historical checkpoint queries. */
export type CheckpointHistoryFilter = {
  /** Return only checkpoints with trigger_timestamp >= this timestamp. */
  after: InputMaybe<Scalars["String"]["input"]>
  /** Return only checkpoints with trigger_timestamp <= this timestamp. */
  before: InputMaybe<Scalars["String"]["input"]>
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars["String"]["input"]>
  /** Filter to savepoints only. */
  isSavepoint: InputMaybe<Scalars["Boolean"]["input"]>
  /** Filter by job ID. */
  jobID: InputMaybe<Scalars["String"]["input"]>
  /** Filter by checkpoint status (e.g. COMPLETED, FAILED, IN_PROGRESS). */
  status: InputMaybe<Scalars["String"]["input"]>
}

/** Page info for checkpoint history pagination. */
export type CheckpointHistoryPageInfo = {
  __typename?: "CheckpointHistoryPageInfo"
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars["String"]["output"]>
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars["Boolean"]["output"]
}

export type CheckpointLatest = {
  __typename?: "CheckpointLatest"
  completed: Maybe<CheckpointHistoryEntry>
  failed: Maybe<CheckpointHistoryEntry>
  restored: Maybe<CheckpointRestoredInfo>
  savepoint: Maybe<CheckpointHistoryEntry>
}

export type CheckpointMinMaxAvg = {
  __typename?: "CheckpointMinMaxAvg"
  avg: Scalars["String"]["output"]
  max: Scalars["String"]["output"]
  min: Scalars["String"]["output"]
}

export type CheckpointRestoredInfo = {
  __typename?: "CheckpointRestoredInfo"
  externalPath: Maybe<Scalars["String"]["output"]>
  id: Scalars["String"]["output"]
  isSavepoint: Scalars["Boolean"]["output"]
  restoreTimestamp: Scalars["String"]["output"]
}

export type CheckpointStats = {
  __typename?: "CheckpointStats"
  counts: CheckpointCounts
  history: Array<CheckpointHistoryEntry>
  latest: Maybe<CheckpointLatest>
  summary: Maybe<CheckpointSummary>
}

export type CheckpointSummary = {
  __typename?: "CheckpointSummary"
  checkpointedSize: Maybe<CheckpointMinMaxAvg>
  endToEndDuration: Maybe<CheckpointMinMaxAvg>
  persistedData: Maybe<CheckpointMinMaxAvg>
  processedData: Maybe<CheckpointMinMaxAvg>
  stateSize: Maybe<CheckpointMinMaxAvg>
}

/** Information about a registered Flink cluster connection. */
export type ClusterInfo = {
  __typename?: "ClusterInfo"
  capabilities: Array<Scalars["String"]["output"]>
  lastCheckTime: Maybe<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  status: ClusterStatus
  url: Scalars["String"]["output"]
  version: Maybe<Scalars["String"]["output"]>
}

/** A cluster overview snapshot capturing capacity and job counts at a point in time. */
export type ClusterOverviewSnapshot = {
  __typename?: "ClusterOverviewSnapshot"
  /** When this snapshot was captured (RFC3339). */
  capturedAt: Scalars["String"]["output"]
  /** Cluster name. */
  cluster: Scalars["String"]["output"]
  /** Flink version string. */
  flinkVersion: Scalars["String"]["output"]
  /** Number of cancelled jobs. */
  jobsCancelled: Scalars["Int"]["output"]
  /** Number of failed jobs. */
  jobsFailed: Scalars["Int"]["output"]
  /** Number of finished jobs. */
  jobsFinished: Scalars["Int"]["output"]
  /** Number of running jobs. */
  jobsRunning: Scalars["Int"]["output"]
  /** Available (free) task slots. */
  slotsAvailable: Scalars["Int"]["output"]
  /** Total task slots. */
  slotsTotal: Scalars["Int"]["output"]
  /** Number of task managers. */
  taskManagers: Scalars["Int"]["output"]
}

/** Health status of a registered Flink cluster. */
export type ClusterStatus = "HEALTHY" | "UNHEALTHY" | "UNKNOWN"

export type ColumnInfo = {
  __typename?: "ColumnInfo"
  name: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
}

export type DashboardConfig = {
  __typename?: "DashboardConfig"
  clusters: Array<Scalars["String"]["output"]>
  instruments: Array<Scalars["String"]["output"]>
}

/** A column in a database table. */
export type DatabaseColumn = {
  __typename?: "DatabaseColumn"
  comment: Scalars["String"]["output"]
  dataType: Scalars["String"]["output"]
  defaultValue: Scalars["String"]["output"]
  isPrimaryKey: Scalars["Boolean"]["output"]
  name: Scalars["String"]["output"]
  nullable: Scalars["Boolean"]["output"]
}

/** A constraint on a database table. */
export type DatabaseConstraint = {
  __typename?: "DatabaseConstraint"
  columns: Array<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  refColumns: Array<Scalars["String"]["output"]>
  refTable: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
}

/** An index on a database table. */
export type DatabaseIndex = {
  __typename?: "DatabaseIndex"
  columns: Array<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
  unique: Scalars["Boolean"]["output"]
}

/** A recorded query execution in the history. */
export type DatabaseQueryHistoryEntry = {
  __typename?: "DatabaseQueryHistoryEntry"
  error: Maybe<Scalars["String"]["output"]>
  executedAt: Scalars["String"]["output"]
  executionTimeMs: Scalars["Int"]["output"]
  rowCount: Scalars["Int"]["output"]
  sql: Scalars["String"]["output"]
}

/** Result of executing a database query. */
export type DatabaseQueryResult = {
  __typename?: "DatabaseQueryResult"
  columns: Array<DatabaseResultColumn>
  executionTimeMs: Scalars["Int"]["output"]
  rowCount: Scalars["Int"]["output"]
  rows: Array<Maybe<Array<Maybe<Scalars["JSON"]["output"]>>>>
  truncated: Scalars["Boolean"]["output"]
}

/** A column in a query result set. */
export type DatabaseResultColumn = {
  __typename?: "DatabaseResultColumn"
  dataType: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
}

/** A database schema (e.g., public, analytics). */
export type DatabaseSchema = {
  __typename?: "DatabaseSchema"
  name: Scalars["String"]["output"]
  tableCount: Scalars["Int"]["output"]
}

/** Detailed information about a database table. */
export type DatabaseTableDetail = {
  __typename?: "DatabaseTableDetail"
  columns: Array<DatabaseColumn>
  constraints: Array<DatabaseConstraint>
  indexes: Array<DatabaseIndex>
  name: Scalars["String"]["output"]
  schema: Scalars["String"]["output"]
}

/** Summary of a database table within a schema. */
export type DatabaseTableSummary = {
  __typename?: "DatabaseTableSummary"
  name: Scalars["String"]["output"]
  rowCountEstimate: Scalars["Int"]["output"]
  schema: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
}

export type DeleteResult = {
  __typename?: "DeleteResult"
  success: Scalars["Boolean"]["output"]
}

export type ExceptionEntry = {
  __typename?: "ExceptionEntry"
  endpoint: Maybe<Scalars["String"]["output"]>
  exceptionName: Scalars["String"]["output"]
  stacktrace: Scalars["String"]["output"]
  taskManagerId: Maybe<Scalars["String"]["output"]>
  taskName: Maybe<Scalars["String"]["output"]>
  timestamp: Scalars["String"]["output"]
}

/** Connection type for paginated exception history results. */
export type ExceptionHistoryConnection = {
  __typename?: "ExceptionHistoryConnection"
  /** List of exception history edges. */
  edges: Array<ExceptionHistoryEdge>
  /** Pagination metadata. */
  pageInfo: ExceptionHistoryPageInfo
}

/** A single edge in the exception history connection. */
export type ExceptionHistoryEdge = {
  __typename?: "ExceptionHistoryEdge"
  /** Opaque cursor for this edge. */
  cursor: Scalars["String"]["output"]
  /** The exception record. */
  node: StoredException
}

/** Filter criteria for historical exception queries. */
export type ExceptionHistoryFilter = {
  /** Return only exceptions with timestamp >= this timestamp. */
  after: InputMaybe<Scalars["String"]["input"]>
  /** Return only exceptions with timestamp <= this timestamp. */
  before: InputMaybe<Scalars["String"]["input"]>
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars["String"]["input"]>
  /** Filter by exception name (case-insensitive substring match). */
  exceptionName: InputMaybe<Scalars["String"]["input"]>
  /** Filter by job ID. */
  jobID: InputMaybe<Scalars["String"]["input"]>
}

/** Page info for exception history pagination. */
export type ExceptionHistoryPageInfo = {
  __typename?: "ExceptionHistoryPageInfo"
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars["String"]["output"]>
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars["Boolean"]["output"]
}

export type Flamegraph = {
  __typename?: "Flamegraph"
  data: FlamegraphNode
  endTimestamp: Scalars["String"]["output"]
}

export type FlamegraphNode = {
  __typename?: "FlamegraphNode"
  children: Maybe<Array<FlamegraphNode>>
  name: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

export type FlinkConfig = {
  __typename?: "FlinkConfig"
  features: FlinkFeatures
  flinkRevision: Scalars["String"]["output"]
  flinkVersion: Scalars["String"]["output"]
  refreshInterval: Scalars["Int"]["output"]
  timezoneName: Scalars["String"]["output"]
  timezoneOffset: Scalars["String"]["output"]
}

export type FlinkFeatures = {
  __typename?: "FlinkFeatures"
  webCancel: Scalars["Boolean"]["output"]
  webHistory: Scalars["Boolean"]["output"]
  webRescale: Scalars["Boolean"]["output"]
  webSubmit: Scalars["Boolean"]["output"]
}

/** Information about a registered infrastructure instrument. */
export type InstrumentInfo = {
  __typename?: "InstrumentInfo"
  capabilities: Array<Scalars["String"]["output"]>
  displayName: Scalars["String"]["output"]
  healthy: Scalars["Boolean"]["output"]
  lastHealthCheck: Maybe<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
  version: Scalars["String"]["output"]
}

export type JmConfigEntry = {
  __typename?: "JMConfigEntry"
  key: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

export type JmEnvironment = {
  __typename?: "JMEnvironment"
  classpath: Array<Scalars["String"]["output"]>
  jvm: JmEnvironmentJvm
}

export type JmEnvironmentJvm = {
  __typename?: "JMEnvironmentJVM"
  arch: Scalars["String"]["output"]
  options: Array<Scalars["String"]["output"]>
  version: Scalars["String"]["output"]
}

export type JarEntryPoint = {
  __typename?: "JarEntryPoint"
  description: Maybe<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
}

export type JarFile = {
  __typename?: "JarFile"
  entry: Array<JarEntryPoint>
  id: Scalars["ID"]["output"]
  name: Scalars["String"]["output"]
  uploaded: Scalars["String"]["output"]
}

export type JarRunResult = {
  __typename?: "JarRunResult"
  jobId: Scalars["String"]["output"]
}

export type JarUploadResult = {
  __typename?: "JarUploadResult"
  filename: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
}

export type JobDetail = {
  __typename?: "JobDetail"
  accumulators: Maybe<Array<VertexAccumulators>>
  backPressure: Maybe<Array<VertexBackPressure>>
  checkpointConfig: Maybe<CheckpointConfig>
  checkpoints: Maybe<CheckpointStats>
  duration: Scalars["String"]["output"]
  endTime: Scalars["String"]["output"]
  exceptions: Array<ExceptionEntry>
  id: Scalars["ID"]["output"]
  name: Scalars["String"]["output"]
  now: Scalars["String"]["output"]
  plan: JobPlan
  startTime: Scalars["String"]["output"]
  state: Scalars["String"]["output"]
  vertexDetails: Maybe<Array<VertexDetail>>
  vertices: Array<JobVertex>
  watermarks: Maybe<Array<VertexWatermarks>>
}

/** Connection type for paginated job history results. */
export type JobHistoryConnection = {
  __typename?: "JobHistoryConnection"
  /** List of job history edges. */
  edges: Array<JobHistoryEdge>
  /** Pagination metadata. */
  pageInfo: JobHistoryPageInfo
}

/** A single edge in the job history connection. */
export type JobHistoryEdge = {
  __typename?: "JobHistoryEdge"
  /** Opaque cursor for this edge. */
  cursor: Scalars["String"]["output"]
  /** The job record. */
  node: JobHistoryEntry
}

/** A historical job record from PostgreSQL. */
export type JobHistoryEntry = {
  __typename?: "JobHistoryEntry"
  capturedAt: Scalars["String"]["output"]
  cluster: Scalars["String"]["output"]
  durationMs: Scalars["String"]["output"]
  endTime: Maybe<Scalars["String"]["output"]>
  jid: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
  startTime: Maybe<Scalars["String"]["output"]>
  state: Scalars["String"]["output"]
  tasksCanceled: Scalars["Int"]["output"]
  tasksFailed: Scalars["Int"]["output"]
  tasksFinished: Scalars["Int"]["output"]
  tasksRunning: Scalars["Int"]["output"]
  tasksTotal: Scalars["Int"]["output"]
}

/** Filter criteria for historical job queries. */
export type JobHistoryFilter = {
  /** Return only jobs with start_time >= this timestamp. */
  after: InputMaybe<Scalars["String"]["input"]>
  /** Return only jobs with start_time <= this timestamp. */
  before: InputMaybe<Scalars["String"]["input"]>
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars["String"]["input"]>
  /** Filter by job name (case-insensitive substring match). */
  name: InputMaybe<Scalars["String"]["input"]>
  /** Filter by job state (e.g. RUNNING, FAILED, FINISHED, CANCELED). */
  state: InputMaybe<Scalars["String"]["input"]>
  /** Preset time range filter. Custom after/before takes precedence if both provided. */
  timeRange: InputMaybe<TimeRange>
}

/** Sortable fields for job history results. */
export type JobHistoryOrderField =
  | "DURATION"
  | "END_TIME"
  | "NAME"
  | "START_TIME"
  | "STATE"

/** Page info for cursor-based pagination. */
export type JobHistoryPageInfo = {
  __typename?: "JobHistoryPageInfo"
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars["String"]["output"]>
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars["Boolean"]["output"]
  /** Total number of items matching the filter (for UI pagination controls). */
  totalCount: Scalars["Int"]["output"]
}

export type JobManagerDetail = {
  __typename?: "JobManagerDetail"
  config: Array<JmConfigEntry>
  environment: Maybe<JmEnvironment>
  metrics: Array<MetricEntry>
}

export type JobOverview = {
  __typename?: "JobOverview"
  duration: Scalars["String"]["output"]
  endTime: Scalars["String"]["output"]
  id: Scalars["ID"]["output"]
  lastModification: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
  startTime: Scalars["String"]["output"]
  state: Scalars["String"]["output"]
  tasks: TaskCounts
}

export type JobPlan = {
  __typename?: "JobPlan"
  jid: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
  nodes: Array<PlanNode>
  type: Scalars["String"]["output"]
}

/** A job status transition event emitted when a Flink job changes state. */
export type JobStatusEvent = {
  __typename?: "JobStatusEvent"
  cluster: Scalars["String"]["output"]
  currentStatus: Scalars["String"]["output"]
  jobId: Scalars["String"]["output"]
  jobName: Scalars["String"]["output"]
  previousStatus: Maybe<Scalars["String"]["output"]>
}

export type JobVertex = {
  __typename?: "JobVertex"
  duration: Scalars["String"]["output"]
  endTime: Scalars["String"]["output"]
  id: Scalars["ID"]["output"]
  maxParallelism: Scalars["Int"]["output"]
  metrics: VertexMetrics
  name: Scalars["String"]["output"]
  parallelism: Scalars["Int"]["output"]
  startTime: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
  tasks: TaskCounts
}

/** A Kafka topic or broker configuration entry. */
export type KafkaConfigEntry = {
  __typename?: "KafkaConfigEntry"
  key: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

/** Summary of a Kafka consumer group. */
export type KafkaConsumerGroup = {
  __typename?: "KafkaConsumerGroup"
  groupId: Scalars["String"]["output"]
  memberCount: Scalars["Int"]["output"]
  state: Scalars["String"]["output"]
  totalLag: Scalars["Int"]["output"]
}

/** Detailed information about a Kafka consumer group. */
export type KafkaConsumerGroupDetail = {
  __typename?: "KafkaConsumerGroupDetail"
  groupId: Scalars["String"]["output"]
  members: Array<KafkaGroupMember>
  offsets: Array<KafkaPartitionOffset>
  protocol: Scalars["String"]["output"]
  protocolType: Scalars["String"]["output"]
  state: Scalars["String"]["output"]
}

/** A member of a Kafka consumer group. */
export type KafkaGroupMember = {
  __typename?: "KafkaGroupMember"
  assignments: Array<KafkaTopicPartition>
  clientHost: Scalars["String"]["output"]
  clientId: Scalars["String"]["output"]
}

/** A single partition within a Kafka topic. */
export type KafkaPartition = {
  __typename?: "KafkaPartition"
  id: Scalars["Int"]["output"]
  inSyncReplicas: Array<Scalars["Int"]["output"]>
  leader: Scalars["Int"]["output"]
  replicas: Array<Scalars["Int"]["output"]>
}

/** Per-partition offset and lag for a consumer group. */
export type KafkaPartitionOffset = {
  __typename?: "KafkaPartitionOffset"
  committedOffset: Scalars["Int"]["output"]
  endOffset: Scalars["Int"]["output"]
  lag: Scalars["Int"]["output"]
  partition: Scalars["Int"]["output"]
  topic: Scalars["String"]["output"]
}

/** Summary of a Kafka topic. */
export type KafkaTopic = {
  __typename?: "KafkaTopic"
  internal: Scalars["Boolean"]["output"]
  name: Scalars["String"]["output"]
  partitionCount: Scalars["Int"]["output"]
  replicationFactor: Scalars["Int"]["output"]
}

/** Detailed information about a Kafka topic including partitions and config. */
export type KafkaTopicDetail = {
  __typename?: "KafkaTopicDetail"
  configEntries: Array<KafkaConfigEntry>
  internal: Scalars["Boolean"]["output"]
  messageCount: Scalars["Int"]["output"]
  name: Scalars["String"]["output"]
  partitionCount: Scalars["Int"]["output"]
  partitions: Array<KafkaPartition>
  replicationFactor: Scalars["Int"]["output"]
}

/** A topic-partition assignment. */
export type KafkaTopicPartition = {
  __typename?: "KafkaTopicPartition"
  partition: Scalars["Int"]["output"]
  topic: Scalars["String"]["output"]
}

export type MaterializedTable = {
  __typename?: "MaterializedTable"
  catalog: Scalars["String"]["output"]
  database: Scalars["String"]["output"]
  definingQuery: Maybe<Scalars["String"]["output"]>
  freshness: Maybe<Scalars["String"]["output"]>
  name: Scalars["String"]["output"]
  refreshMode: Maybe<Scalars["String"]["output"]>
  refreshStatus: MaterializedTableRefreshStatus
}

export type MaterializedTableRefreshStatus =
  | "ACTIVATED"
  | "INITIALIZING"
  | "SUSPENDED"

/** A single metric data point in a time series. */
export type MetricDataPoint = {
  __typename?: "MetricDataPoint"
  /** When this data point was captured (RFC3339). */
  capturedAt: Scalars["String"]["output"]
  /** The metric value. */
  value: Scalars["Float"]["output"]
}

export type MetricEntry = {
  __typename?: "MetricEntry"
  id: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

/** Filter criteria for metric time-series queries. */
export type MetricHistoryFilter = {
  /** Return only data points captured after this timestamp (RFC3339). */
  after: InputMaybe<Scalars["String"]["input"]>
  /** Return only data points captured before this timestamp (RFC3339). */
  before: InputMaybe<Scalars["String"]["input"]>
  /** Filter by cluster name (required). */
  clusterID: Scalars["String"]["input"]
  /** Filter by metric ID (e.g. Status.JVM.CPU.Load). */
  metricID: InputMaybe<Scalars["String"]["input"]>
  /** Filter by source ID (e.g. TM ID, vertex ID). */
  sourceID: InputMaybe<Scalars["String"]["input"]>
  /** Filter by source type: job_manager, task_manager, vertex. */
  sourceType: InputMaybe<Scalars["String"]["input"]>
}

export type Mutation = {
  __typename?: "Mutation"
  /** Cancel a running job */
  cancelJob: CancelJobResult
  /** Close a SQL Gateway session */
  closeSQLSession: SqlCloseResult
  /** Create a new SQL Gateway session */
  createSQLSession: SqlSessionResult
  /** Delete an uploaded JAR */
  deleteJar: DeleteResult
  /**
   * Execute a read-only SQL query against a database instrument.
   * DDL statements are rejected. Results are capped at the configured row limit.
   */
  executeDatabaseQuery: DatabaseQueryResult
  /** Fetch results from a SQL statement execution */
  fetchSQLResults: SqlFetchResult
  /** Trigger a manual refresh of a materialized table */
  refreshMaterializedTable: MaterializedTable
  /** Resume a materialized table's refresh */
  resumeMaterializedTable: MaterializedTable
  /** Run an uploaded JAR to submit a job */
  runJar: JarRunResult
  /** Submit a SQL statement to an existing session */
  submitStatement: SqlStatementResult
  /** Suspend a materialized table's refresh */
  suspendMaterializedTable: MaterializedTable
}

export type MutationCancelJobArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type MutationCloseSqlSessionArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  sessionHandle: Scalars["String"]["input"]
}

export type MutationCreateSqlSessionArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type MutationDeleteJarArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type MutationExecuteDatabaseQueryArgs = {
  instrument: Scalars["String"]["input"]
  sql: Scalars["String"]["input"]
}

export type MutationFetchSqlResultsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  operationHandle: Scalars["String"]["input"]
  sessionHandle: Scalars["String"]["input"]
  token: InputMaybe<Scalars["String"]["input"]>
}

export type MutationRefreshMaterializedTableArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  name: Scalars["String"]["input"]
}

export type MutationResumeMaterializedTableArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  name: Scalars["String"]["input"]
}

export type MutationRunJarArgs = {
  allowNonRestoredState: InputMaybe<Scalars["Boolean"]["input"]>
  cluster: InputMaybe<Scalars["String"]["input"]>
  entryClass: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
  parallelism: InputMaybe<Scalars["Int"]["input"]>
  programArgs: InputMaybe<Scalars["String"]["input"]>
  savepointPath: InputMaybe<Scalars["String"]["input"]>
}

export type MutationSubmitStatementArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  sessionHandle: Scalars["String"]["input"]
  statement: Scalars["String"]["input"]
}

export type MutationSuspendMaterializedTableArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  name: Scalars["String"]["input"]
}

/** Sorting configuration for query results. */
export type OrderByInput = {
  /** Sort direction (ASC or DESC). */
  direction: OrderDirection
  /** The field to sort by. */
  field: JobHistoryOrderField
}

/** Sort direction. */
export type OrderDirection = "ASC" | "DESC"

/** Cursor-based pagination input. */
export type PaginationInput = {
  /** Opaque cursor for the next page. */
  after: InputMaybe<Scalars["String"]["input"]>
  /** Maximum number of items to return. */
  first: InputMaybe<Scalars["Int"]["input"]>
}

export type PlanNode = {
  __typename?: "PlanNode"
  description: Scalars["String"]["output"]
  id: Scalars["String"]["output"]
  inputs: Maybe<Array<PlanNodeInput>>
  operator: Scalars["String"]["output"]
  operatorStrategy: Scalars["String"]["output"]
  parallelism: Scalars["Int"]["output"]
}

export type PlanNodeInput = {
  __typename?: "PlanNodeInput"
  exchange: Scalars["String"]["output"]
  id: Scalars["String"]["output"]
  num: Scalars["Int"]["output"]
  shipStrategy: Scalars["String"]["output"]
}

export type Query = {
  __typename?: "Query"
  blueGreenDeployment: Maybe<BlueGreenDeployment>
  blueGreenDeployments: Array<BlueGreenDeployment>
  /** List columns for a table */
  catalogColumns: Array<ColumnInfo>
  /** List databases within a catalog */
  catalogDatabases: Array<CatalogDatabase>
  /** List tables within a catalog database */
  catalogTables: Array<CatalogTable>
  /** List all registered Flink catalogs */
  catalogs: Array<CatalogInfo>
  /** Get checkpoint detail */
  checkpointDetail: CheckpointHistoryEntry
  /** Returns paginated historical checkpoints with optional filtering. */
  checkpointHistory: CheckpointHistoryConnection
  /** Returns historical cluster overview snapshots for capacity trend analysis. */
  clusterOverviewHistory: Array<ClusterOverviewSnapshot>
  clusters: Array<ClusterInfo>
  /** Get dashboard configuration (available clusters and instruments) */
  dashboardConfig: DashboardConfig
  /** Get query execution history for a database instrument. */
  databaseQueryHistory: Array<DatabaseQueryHistoryEntry>
  /** List schemas for a database instrument. */
  databaseSchemas: Array<DatabaseSchema>
  /** Get detailed information about a specific database table. */
  databaseTable: DatabaseTableDetail
  /** List tables in a schema for a database instrument. */
  databaseTables: Array<DatabaseTableSummary>
  /** Returns paginated historical exceptions with optional filtering. */
  exceptionHistory: ExceptionHistoryConnection
  /** Get flamegraph for a vertex */
  flamegraph: Flamegraph
  /** Get Flink cluster configuration */
  flinkConfig: FlinkConfig
  health: Scalars["Boolean"]["output"]
  /** List all registered instruments with their health status and capabilities. */
  instruments: Array<InstrumentInfo>
  /** List all uploaded JARs */
  jars: Array<JarFile>
  /** Get detailed job information including vertices, checkpoints, exceptions */
  job: JobDetail
  /** Returns paginated historical jobs with optional filtering and sorting. */
  jobHistory: JobHistoryConnection
  /** Get job manager config, environment, and metrics */
  jobManager: JobManagerDetail
  /** List all jobs in a cluster */
  jobs: Array<JobOverview>
  /** Get detailed information about a specific consumer group. */
  kafkaConsumerGroup: KafkaConsumerGroupDetail
  /** List consumer groups for a Kafka instrument. */
  kafkaConsumerGroups: Array<KafkaConsumerGroup>
  /** Get detailed information about a specific Kafka topic. */
  kafkaTopic: KafkaTopicDetail
  /** List topics for a Kafka instrument. */
  kafkaTopics: Array<KafkaTopic>
  /** Get a single materialized table by name and catalog */
  materializedTable: Maybe<MaterializedTable>
  /** List materialized tables, optionally filtered by catalog */
  materializedTables: Array<MaterializedTable>
  /** Returns time-series metric data points matching the filter. */
  metricHistory: Array<MetricDataPoint>
  /** Returns the status of the PostgreSQL storage backend. */
  storageStatus: StorageStatus
  /** Get subtask times for a vertex */
  subtaskTimes: SubtaskTimes
  /** List all loaded tap pipeline manifests */
  tapManifests: Array<TapManifest>
  /** Get detailed task manager info with metrics */
  taskManager: TaskManagerDetail
  /** Get task manager logs list */
  taskManagerLogs: Array<TmLogEntry>
  /** Get task manager thread dump */
  taskManagerThreadDump: Array<ThreadDumpEntry>
  /** List all task managers in a cluster */
  taskManagers: Array<TaskManagerOverview>
  /** Get vertex detail with subtask info */
  vertexDetail: VertexDetail
}

export type QueryBlueGreenDeploymentArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  name: Scalars["String"]["input"]
  namespace: InputMaybe<Scalars["String"]["input"]>
}

export type QueryBlueGreenDeploymentsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  namespace: InputMaybe<Scalars["String"]["input"]>
}

export type QueryCatalogColumnsArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  database: Scalars["String"]["input"]
  table: Scalars["String"]["input"]
}

export type QueryCatalogDatabasesArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryCatalogTablesArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  database: Scalars["String"]["input"]
}

export type QueryCatalogsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryCheckpointDetailArgs = {
  checkpointId: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  jobId: Scalars["ID"]["input"]
}

export type QueryCheckpointHistoryArgs = {
  filter: InputMaybe<CheckpointHistoryFilter>
  pagination: InputMaybe<PaginationInput>
}

export type QueryClusterOverviewHistoryArgs = {
  after: InputMaybe<Scalars["String"]["input"]>
  before: InputMaybe<Scalars["String"]["input"]>
  clusterID: Scalars["String"]["input"]
}

export type QueryDatabaseQueryHistoryArgs = {
  instrument: Scalars["String"]["input"]
}

export type QueryDatabaseSchemasArgs = {
  instrument: Scalars["String"]["input"]
}

export type QueryDatabaseTableArgs = {
  instrument: Scalars["String"]["input"]
  schema: Scalars["String"]["input"]
  table: Scalars["String"]["input"]
}

export type QueryDatabaseTablesArgs = {
  instrument: Scalars["String"]["input"]
  schema: Scalars["String"]["input"]
}

export type QueryExceptionHistoryArgs = {
  filter: InputMaybe<ExceptionHistoryFilter>
  pagination: InputMaybe<PaginationInput>
}

export type QueryFlamegraphArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  jobId: Scalars["ID"]["input"]
  type: Scalars["String"]["input"]
  vertexId: Scalars["ID"]["input"]
}

export type QueryFlinkConfigArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryJarsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryJobArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type QueryJobHistoryArgs = {
  filter: InputMaybe<JobHistoryFilter>
  orderBy: InputMaybe<OrderByInput>
  pagination: InputMaybe<PaginationInput>
}

export type QueryJobManagerArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryJobsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryKafkaConsumerGroupArgs = {
  groupId: Scalars["String"]["input"]
  instrument: Scalars["String"]["input"]
}

export type QueryKafkaConsumerGroupsArgs = {
  instrument: Scalars["String"]["input"]
}

export type QueryKafkaTopicArgs = {
  instrument: Scalars["String"]["input"]
  name: Scalars["String"]["input"]
}

export type QueryKafkaTopicsArgs = {
  instrument: Scalars["String"]["input"]
}

export type QueryMaterializedTableArgs = {
  catalog: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
  name: Scalars["String"]["input"]
}

export type QueryMaterializedTablesArgs = {
  catalog: InputMaybe<Scalars["String"]["input"]>
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryMetricHistoryArgs = {
  filter: MetricHistoryFilter
}

export type QuerySubtaskTimesArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  jobId: Scalars["ID"]["input"]
  vertexId: Scalars["ID"]["input"]
}

export type QueryTaskManagerArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type QueryTaskManagerLogsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type QueryTaskManagerThreadDumpArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  id: Scalars["ID"]["input"]
}

export type QueryTaskManagersArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type QueryVertexDetailArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  jobId: Scalars["ID"]["input"]
  vertexId: Scalars["ID"]["input"]
}

export type SqlCloseResult = {
  __typename?: "SQLCloseResult"
  success: Scalars["Boolean"]["output"]
}

/** A column descriptor from SQL Gateway results. */
export type SqlColumn = {
  __typename?: "SQLColumn"
  dataType: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
}

export type SqlFetchResult = {
  __typename?: "SQLFetchResult"
  columns: Array<SqlColumn>
  hasMore: Scalars["Boolean"]["output"]
  nextToken: Maybe<Scalars["String"]["output"]>
  rows: Array<Maybe<Array<Maybe<Scalars["String"]["output"]>>>>
}

/** A batch of SQL Gateway query results. */
export type SqlResultBatch = {
  __typename?: "SQLResultBatch"
  columns: Array<SqlColumn>
  hasMore: Scalars["Boolean"]["output"]
  rows: Array<Maybe<Array<Maybe<Scalars["String"]["output"]>>>>
}

export type SqlSessionResult = {
  __typename?: "SQLSessionResult"
  sessionHandle: Scalars["String"]["output"]
}

export type SqlStatementResult = {
  __typename?: "SQLStatementResult"
  operationHandle: Scalars["String"]["output"]
}

/** Status of the PostgreSQL historical storage backend. */
export type StorageStatus = {
  __typename?: "StorageStatus"
  /** Whether the database connection is healthy. */
  connected: Scalars["Boolean"]["output"]
  /** Whether storage is enabled in configuration. */
  enabled: Scalars["Boolean"]["output"]
  /** Idle connections in the pool. */
  idleConns: Scalars["Int"]["output"]
  /** Current migration version applied, empty if none. */
  migrationVersion: Scalars["String"]["output"]
  /** Total connections in the pool. */
  totalConns: Scalars["Int"]["output"]
}

/** A historical checkpoint record from PostgreSQL. */
export type StoredCheckpoint = {
  __typename?: "StoredCheckpoint"
  capturedAt: Scalars["String"]["output"]
  checkpointID: Scalars["String"]["output"]
  checkpointedSize: Maybe<Scalars["String"]["output"]>
  cluster: Scalars["String"]["output"]
  endToEndDuration: Scalars["String"]["output"]
  isSavepoint: Scalars["Boolean"]["output"]
  jid: Scalars["String"]["output"]
  latestAck: Maybe<Scalars["String"]["output"]>
  numAckSubtasks: Scalars["Int"]["output"]
  numSubtasks: Scalars["Int"]["output"]
  persistedData: Scalars["String"]["output"]
  processedData: Scalars["String"]["output"]
  stateSize: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
  triggerTimestamp: Maybe<Scalars["String"]["output"]>
}

/** A historical exception record from PostgreSQL. */
export type StoredException = {
  __typename?: "StoredException"
  capturedAt: Scalars["String"]["output"]
  cluster: Scalars["String"]["output"]
  endpoint: Maybe<Scalars["String"]["output"]>
  exceptionName: Scalars["String"]["output"]
  id: Scalars["String"]["output"]
  jid: Scalars["String"]["output"]
  stacktrace: Maybe<Scalars["String"]["output"]>
  taskManagerID: Maybe<Scalars["String"]["output"]>
  taskName: Maybe<Scalars["String"]["output"]>
  timestamp: Scalars["String"]["output"]
}

export type Subscription = {
  __typename?: "Subscription"
  blueGreenStateChanged: BlueGreenDeployment
  /**
   * Emits a JobStatusEvent whenever any Flink job's status changes.
   * Optionally scoped to a specific cluster.
   */
  jobStatusChanged: JobStatusEvent
  /** Streams result batches from a SQL Gateway operation. */
  sqlResults: SqlResultBatch
}

export type SubscriptionBlueGreenStateChangedArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  namespace: InputMaybe<Scalars["String"]["input"]>
}

export type SubscriptionJobStatusChangedArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
}

export type SubscriptionSqlResultsArgs = {
  cluster: InputMaybe<Scalars["String"]["input"]>
  operationHandle: Scalars["String"]["input"]
  sessionHandle: Scalars["String"]["input"]
}

export type SubtaskBackPressure = {
  __typename?: "SubtaskBackPressure"
  attemptNumber: Scalars["Int"]["output"]
  backpressureLevel: Scalars["String"]["output"]
  busyRatio: Scalars["Float"]["output"]
  idleRatio: Scalars["Float"]["output"]
  ratio: Scalars["Float"]["output"]
  subtask: Scalars["Int"]["output"]
}

export type SubtaskInfo = {
  __typename?: "SubtaskInfo"
  attempt: Scalars["Int"]["output"]
  duration: Scalars["String"]["output"]
  endTime: Scalars["String"]["output"]
  endpoint: Scalars["String"]["output"]
  metrics: VertexMetrics
  startTime: Scalars["String"]["output"]
  status: Scalars["String"]["output"]
  subtask: Scalars["Int"]["output"]
  taskManagerId: Scalars["String"]["output"]
}

export type SubtaskTimes = {
  __typename?: "SubtaskTimes"
  id: Scalars["ID"]["output"]
  name: Scalars["String"]["output"]
  now: Scalars["String"]["output"]
  subtasks: Array<SubtaskTimesEntry>
}

export type SubtaskTimesEntry = {
  __typename?: "SubtaskTimesEntry"
  duration: Scalars["String"]["output"]
  host: Scalars["String"]["output"]
  subtask: Scalars["Int"]["output"]
  timestamps: Array<TimestampEntry>
}

export type TmLogEntry = {
  __typename?: "TMLogEntry"
  name: Scalars["String"]["output"]
  size: Scalars["String"]["output"]
}

export type TapManifest = {
  __typename?: "TapManifest"
  config: Maybe<Scalars["JSON"]["output"]>
  description: Scalars["String"]["output"]
  name: Scalars["String"]["output"]
  version: Scalars["String"]["output"]
}

export type TaskCounts = {
  __typename?: "TaskCounts"
  canceled: Scalars["Int"]["output"]
  canceling: Scalars["Int"]["output"]
  created: Scalars["Int"]["output"]
  deploying: Scalars["Int"]["output"]
  failed: Scalars["Int"]["output"]
  finished: Scalars["Int"]["output"]
  initializing: Scalars["Int"]["output"]
  reconciling: Scalars["Int"]["output"]
  running: Scalars["Int"]["output"]
  scheduled: Scalars["Int"]["output"]
}

export type TaskManagerDetail = {
  __typename?: "TaskManagerDetail"
  allocatedSlots: Array<AllocatedSlot>
  dataPort: Scalars["Int"]["output"]
  freeResource: TaskManagerResourceProfile
  freeSlots: Scalars["Int"]["output"]
  hardware: TaskManagerHardware
  id: Scalars["ID"]["output"]
  jmxPort: Scalars["Int"]["output"]
  memoryConfiguration: TaskManagerMemory
  metrics: Array<MetricEntry>
  path: Scalars["String"]["output"]
  slotsNumber: Scalars["Int"]["output"]
  timeSinceLastHeartbeat: Scalars["String"]["output"]
  totalResource: TaskManagerResourceProfile
}

export type TaskManagerHardware = {
  __typename?: "TaskManagerHardware"
  cpuCores: Scalars["Int"]["output"]
  freeMemory: Scalars["String"]["output"]
  managedMemory: Scalars["String"]["output"]
  physicalMemory: Scalars["String"]["output"]
}

export type TaskManagerMemory = {
  __typename?: "TaskManagerMemory"
  frameworkHeap: Scalars["String"]["output"]
  frameworkOffHeap: Scalars["String"]["output"]
  jvmMetaspace: Scalars["String"]["output"]
  jvmOverhead: Scalars["String"]["output"]
  managedMemory: Scalars["String"]["output"]
  networkMemory: Scalars["String"]["output"]
  taskHeap: Scalars["String"]["output"]
  taskOffHeap: Scalars["String"]["output"]
  totalFlinkMemory: Scalars["String"]["output"]
  totalProcessMemory: Scalars["String"]["output"]
}

export type TaskManagerOverview = {
  __typename?: "TaskManagerOverview"
  dataPort: Scalars["Int"]["output"]
  freeResource: TaskManagerResourceProfile
  freeSlots: Scalars["Int"]["output"]
  hardware: TaskManagerHardware
  id: Scalars["ID"]["output"]
  jmxPort: Scalars["Int"]["output"]
  memoryConfiguration: TaskManagerMemory
  path: Scalars["String"]["output"]
  slotsNumber: Scalars["Int"]["output"]
  timeSinceLastHeartbeat: Scalars["String"]["output"]
  totalResource: TaskManagerResourceProfile
}

export type TaskManagerResourceProfile = {
  __typename?: "TaskManagerResourceProfile"
  cpuCores: Scalars["Float"]["output"]
  managedMemory: Scalars["String"]["output"]
  networkMemory: Scalars["String"]["output"]
  taskHeapMemory: Scalars["String"]["output"]
  taskOffHeapMemory: Scalars["String"]["output"]
}

export type ThreadDumpEntry = {
  __typename?: "ThreadDumpEntry"
  stringifiedThreadInfo: Scalars["String"]["output"]
  threadName: Scalars["String"]["output"]
}

/** Preset time range for filtering historical data. */
export type TimeRange =
  | "LAST_1H"
  | "LAST_2H"
  | "LAST_7D"
  | "LAST_24H"
  | "LAST_30D"

export type TimestampEntry = {
  __typename?: "TimestampEntry"
  key: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

export type UserAccumulator = {
  __typename?: "UserAccumulator"
  name: Scalars["String"]["output"]
  type: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

export type VertexAccumulators = {
  __typename?: "VertexAccumulators"
  accumulators: Array<UserAccumulator>
  vertexId: Scalars["ID"]["output"]
}

export type VertexBackPressure = {
  __typename?: "VertexBackPressure"
  backPressure: BackPressureInfo
  vertexId: Scalars["ID"]["output"]
}

export type VertexDetail = {
  __typename?: "VertexDetail"
  id: Scalars["ID"]["output"]
  name: Scalars["String"]["output"]
  now: Scalars["String"]["output"]
  parallelism: Scalars["Int"]["output"]
  subtasks: Array<SubtaskInfo>
}

export type VertexMetrics = {
  __typename?: "VertexMetrics"
  accumulatedBackpressured: Scalars["String"]["output"]
  accumulatedBusy: Scalars["String"]["output"]
  accumulatedIdle: Scalars["String"]["output"]
  readBytes: Scalars["String"]["output"]
  readBytesComplete: Scalars["Boolean"]["output"]
  readRecords: Scalars["String"]["output"]
  readRecordsComplete: Scalars["Boolean"]["output"]
  writeBytes: Scalars["String"]["output"]
  writeBytesComplete: Scalars["Boolean"]["output"]
  writeRecords: Scalars["String"]["output"]
  writeRecordsComplete: Scalars["Boolean"]["output"]
}

export type VertexWatermarks = {
  __typename?: "VertexWatermarks"
  vertexId: Scalars["ID"]["output"]
  watermarks: Array<WatermarkEntry>
}

export type WatermarkEntry = {
  __typename?: "WatermarkEntry"
  id: Scalars["String"]["output"]
  value: Scalars["String"]["output"]
}

export type CheckpointDetailQueryVariables = Exact<{
  jobId: Scalars["ID"]["input"]
  checkpointId: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type CheckpointDetailQuery = {
  __typename?: "Query"
  checkpointDetail: {
    __typename?: "CheckpointHistoryEntry"
    id: string
    status: string
    isSavepoint: boolean
    triggerTimestamp: string
    latestAckTimestamp: string
    stateSize: string
    endToEndDuration: string
    processedData: string
    persistedData: string
    numSubtasks: number
    numAcknowledgedSubtasks: number
    checkpointedSize: string | null
  }
}

export type ClusterOverviewQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type ClusterOverviewQuery = {
  __typename?: "Query"
  clusters: Array<{
    __typename?: "ClusterInfo"
    name: string
    url: string
    status: ClusterStatus
    lastCheckTime: string | null
    version: string | null
  }>
  jobs: Array<{
    __typename?: "JobOverview"
    id: string
    name: string
    state: string
    startTime: string
    endTime: string
    duration: string
    lastModification: string
    tasks: {
      __typename?: "TaskCounts"
      created: number
      scheduled: number
      deploying: number
      running: number
      finished: number
      canceling: number
      canceled: number
      failed: number
      reconciling: number
      initializing: number
    }
  }>
}

export type FlinkConfigQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type FlinkConfigQuery = {
  __typename?: "Query"
  flinkConfig: {
    __typename?: "FlinkConfig"
    refreshInterval: number
    timezoneName: string
    timezoneOffset: string
    flinkVersion: string
    flinkRevision: string
    features: {
      __typename?: "FlinkFeatures"
      webSubmit: boolean
      webCancel: boolean
      webRescale: boolean
      webHistory: boolean
    }
  }
}

export type DashboardConfigQueryVariables = Exact<{ [key: string]: never }>

export type DashboardConfigQuery = {
  __typename?: "Query"
  dashboardConfig: {
    __typename?: "DashboardConfig"
    clusters: Array<string>
    instruments: Array<string>
  }
}

export type DatabaseSchemasQueryVariables = Exact<{
  instrument: Scalars["String"]["input"]
}>

export type DatabaseSchemasQuery = {
  __typename?: "Query"
  databaseSchemas: Array<{
    __typename?: "DatabaseSchema"
    name: string
    tableCount: number
  }>
}

export type DatabaseTablesQueryVariables = Exact<{
  instrument: Scalars["String"]["input"]
  schema: Scalars["String"]["input"]
}>

export type DatabaseTablesQuery = {
  __typename?: "Query"
  databaseTables: Array<{
    __typename?: "DatabaseTableSummary"
    name: string
    schema: string
    type: string
    rowCountEstimate: number
  }>
}

export type DatabaseTableQueryVariables = Exact<{
  instrument: Scalars["String"]["input"]
  schema: Scalars["String"]["input"]
  table: Scalars["String"]["input"]
}>

export type DatabaseTableQuery = {
  __typename?: "Query"
  databaseTable: {
    __typename?: "DatabaseTableDetail"
    name: string
    schema: string
    columns: Array<{
      __typename?: "DatabaseColumn"
      name: string
      dataType: string
      nullable: boolean
      defaultValue: string
      isPrimaryKey: boolean
      comment: string
    }>
    indexes: Array<{
      __typename?: "DatabaseIndex"
      name: string
      columns: Array<string>
      unique: boolean
      type: string
    }>
    constraints: Array<{
      __typename?: "DatabaseConstraint"
      name: string
      type: string
      columns: Array<string>
      refTable: string
      refColumns: Array<string>
    }>
  }
}

export type DatabaseQueryHistoryQueryVariables = Exact<{
  instrument: Scalars["String"]["input"]
}>

export type DatabaseQueryHistoryQuery = {
  __typename?: "Query"
  databaseQueryHistory: Array<{
    __typename?: "DatabaseQueryHistoryEntry"
    sql: string
    executedAt: string
    executionTimeMs: number
    rowCount: number
    error: string | null
  }>
}

export type ExecuteDatabaseQueryMutationVariables = Exact<{
  instrument: Scalars["String"]["input"]
  sql: Scalars["String"]["input"]
}>

export type ExecuteDatabaseQueryMutation = {
  __typename?: "Mutation"
  executeDatabaseQuery: {
    __typename?: "DatabaseQueryResult"
    rows: Array<Array<Record<string, unknown> | null> | null>
    rowCount: number
    executionTimeMs: number
    truncated: boolean
    columns: Array<{
      __typename?: "DatabaseResultColumn"
      name: string
      dataType: string
    }>
  }
}

export type BlueGreenDeploymentsQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
  namespace: InputMaybe<Scalars["String"]["input"]>
}>

export type BlueGreenDeploymentsQuery = {
  __typename?: "Query"
  blueGreenDeployments: Array<{
    __typename?: "BlueGreenDeployment"
    name: string
    namespace: string
    state: BlueGreenState
    jobStatus: string | null
    error: string | null
    lastReconciledTimestamp: string | null
    abortTimestamp: string | null
    deploymentReadyTimestamp: string | null
    blueDeploymentName: string | null
    greenDeploymentName: string | null
    activeJobId: string | null
    pendingJobId: string | null
    abortGracePeriod: string | null
    deploymentDeletionDelay: string | null
  }>
}

export type BlueGreenDeploymentDetailQueryVariables = Exact<{
  name: Scalars["String"]["input"]
  namespace: InputMaybe<Scalars["String"]["input"]>
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type BlueGreenDeploymentDetailQuery = {
  __typename?: "Query"
  blueGreenDeployment: {
    __typename?: "BlueGreenDeployment"
    name: string
    namespace: string
    state: BlueGreenState
    jobStatus: string | null
    error: string | null
    lastReconciledTimestamp: string | null
    abortTimestamp: string | null
    deploymentReadyTimestamp: string | null
    blueDeploymentName: string | null
    greenDeploymentName: string | null
    activeJobId: string | null
    pendingJobId: string | null
    abortGracePeriod: string | null
    deploymentDeletionDelay: string | null
  } | null
}

export type BlueGreenStateChangedSubscriptionVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
  namespace: InputMaybe<Scalars["String"]["input"]>
}>

export type BlueGreenStateChangedSubscription = {
  __typename?: "Subscription"
  blueGreenStateChanged: {
    __typename?: "BlueGreenDeployment"
    name: string
    namespace: string
    state: BlueGreenState
    jobStatus: string | null
    error: string | null
  }
}

export type JobHistoryQueryVariables = Exact<{
  filter: InputMaybe<JobHistoryFilter>
  pagination: InputMaybe<PaginationInput>
  orderBy: InputMaybe<OrderByInput>
}>

export type JobHistoryQuery = {
  __typename?: "Query"
  jobHistory: {
    __typename?: "JobHistoryConnection"
    edges: Array<{
      __typename?: "JobHistoryEdge"
      cursor: string
      node: {
        __typename?: "JobHistoryEntry"
        jid: string
        cluster: string
        name: string
        state: string
        startTime: string | null
        endTime: string | null
        durationMs: string
        tasksTotal: number
        tasksRunning: number
        tasksFinished: number
        tasksCanceled: number
        tasksFailed: number
        capturedAt: string
      }
    }>
    pageInfo: {
      __typename?: "JobHistoryPageInfo"
      hasNextPage: boolean
      endCursor: string | null
      totalCount: number
    }
  }
}

export type InstrumentsQueryVariables = Exact<{ [key: string]: never }>

export type InstrumentsQuery = {
  __typename?: "Query"
  instruments: Array<{
    __typename?: "InstrumentInfo"
    name: string
    displayName: string
    type: string
    version: string
    healthy: boolean
    lastHealthCheck: string | null
    capabilities: Array<string>
  }>
}

export type JarsListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type JarsListQuery = {
  __typename?: "Query"
  jars: Array<{
    __typename?: "JarFile"
    id: string
    name: string
    uploaded: string
    entry: Array<{
      __typename?: "JarEntryPoint"
      name: string
      description: string | null
    }>
  }>
}

export type DeleteJarMutationVariables = Exact<{
  id: Scalars["ID"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type DeleteJarMutation = {
  __typename?: "Mutation"
  deleteJar: { __typename?: "DeleteResult"; success: boolean }
}

export type RunJarMutationVariables = Exact<{
  id: Scalars["ID"]["input"]
  entryClass: InputMaybe<Scalars["String"]["input"]>
  programArgs: InputMaybe<Scalars["String"]["input"]>
  parallelism: InputMaybe<Scalars["Int"]["input"]>
  savepointPath: InputMaybe<Scalars["String"]["input"]>
  allowNonRestoredState: InputMaybe<Scalars["Boolean"]["input"]>
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type RunJarMutation = {
  __typename?: "Mutation"
  runJar: { __typename?: "JarRunResult"; jobId: string }
}

export type JobManagerDetailQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type JobManagerDetailQuery = {
  __typename?: "Query"
  jobManager: {
    __typename?: "JobManagerDetail"
    config: Array<{ __typename?: "JMConfigEntry"; key: string; value: string }>
    environment: {
      __typename?: "JMEnvironment"
      classpath: Array<string>
      jvm: {
        __typename?: "JMEnvironmentJVM"
        version: string
        arch: string
        options: Array<string>
      }
    } | null
    metrics: Array<{ __typename?: "MetricEntry"; id: string; value: string }>
  }
}

export type JobsListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type JobsListQuery = {
  __typename?: "Query"
  jobs: Array<{
    __typename?: "JobOverview"
    id: string
    name: string
    state: string
    startTime: string
    endTime: string
    duration: string
    lastModification: string
    tasks: {
      __typename?: "TaskCounts"
      created: number
      scheduled: number
      deploying: number
      running: number
      finished: number
      canceling: number
      canceled: number
      failed: number
      reconciling: number
      initializing: number
    }
  }>
}

export type JobDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type JobDetailQuery = {
  __typename?: "Query"
  job: {
    __typename?: "JobDetail"
    id: string
    name: string
    state: string
    startTime: string
    endTime: string
    duration: string
    now: string
    vertices: Array<{
      __typename?: "JobVertex"
      id: string
      name: string
      maxParallelism: number
      parallelism: number
      status: string
      startTime: string
      endTime: string
      duration: string
      tasks: {
        __typename?: "TaskCounts"
        created: number
        scheduled: number
        deploying: number
        running: number
        finished: number
        canceling: number
        canceled: number
        failed: number
        reconciling: number
        initializing: number
      }
      metrics: {
        __typename?: "VertexMetrics"
        readBytes: string
        readBytesComplete: boolean
        writeBytes: string
        writeBytesComplete: boolean
        readRecords: string
        readRecordsComplete: boolean
        writeRecords: string
        writeRecordsComplete: boolean
        accumulatedBackpressured: string
        accumulatedIdle: string
        accumulatedBusy: string
      }
    }>
    plan: {
      __typename?: "JobPlan"
      jid: string
      name: string
      type: string
      nodes: Array<{
        __typename?: "PlanNode"
        id: string
        parallelism: number
        operator: string
        operatorStrategy: string
        description: string
        inputs: Array<{
          __typename?: "PlanNodeInput"
          num: number
          id: string
          shipStrategy: string
          exchange: string
        }> | null
      }>
    }
    exceptions: Array<{
      __typename?: "ExceptionEntry"
      exceptionName: string
      stacktrace: string
      timestamp: string
      taskName: string | null
      endpoint: string | null
      taskManagerId: string | null
    }>
    checkpoints: {
      __typename?: "CheckpointStats"
      counts: {
        __typename?: "CheckpointCounts"
        completed: number
        inProgress: number
        failed: number
        total: number
        restored: number
      }
      history: Array<{
        __typename?: "CheckpointHistoryEntry"
        id: string
        status: string
        isSavepoint: boolean
        triggerTimestamp: string
        latestAckTimestamp: string
        stateSize: string
        endToEndDuration: string
        processedData: string
        persistedData: string
        numSubtasks: number
        numAcknowledgedSubtasks: number
        checkpointedSize: string | null
      }>
      summary: {
        __typename?: "CheckpointSummary"
        stateSize: {
          __typename?: "CheckpointMinMaxAvg"
          min: string
          max: string
          avg: string
        } | null
        endToEndDuration: {
          __typename?: "CheckpointMinMaxAvg"
          min: string
          max: string
          avg: string
        } | null
        checkpointedSize: {
          __typename?: "CheckpointMinMaxAvg"
          min: string
          max: string
          avg: string
        } | null
      } | null
      latest: {
        __typename?: "CheckpointLatest"
        completed: {
          __typename?: "CheckpointHistoryEntry"
          id: string
          status: string
          triggerTimestamp: string
          stateSize: string
          endToEndDuration: string
        } | null
        restored: {
          __typename?: "CheckpointRestoredInfo"
          id: string
          restoreTimestamp: string
          isSavepoint: boolean
          externalPath: string | null
        } | null
      } | null
    } | null
    checkpointConfig: {
      __typename?: "CheckpointConfig"
      mode: string
      interval: string
      timeout: string
      minPause: string
      maxConcurrent: number
      externalizedEnabled: boolean
      externalizedDeleteOnCancellation: boolean
      unalignedCheckpoints: boolean
    } | null
    vertexDetails: Array<{
      __typename?: "VertexDetail"
      id: string
      name: string
      parallelism: number
      now: string
      subtasks: Array<{
        __typename?: "SubtaskInfo"
        subtask: number
        status: string
        attempt: number
        endpoint: string
        startTime: string
        endTime: string
        duration: string
        taskManagerId: string
        metrics: {
          __typename?: "VertexMetrics"
          readBytes: string
          readBytesComplete: boolean
          writeBytes: string
          writeBytesComplete: boolean
          readRecords: string
          readRecordsComplete: boolean
          writeRecords: string
          writeRecordsComplete: boolean
          accumulatedBackpressured: string
          accumulatedIdle: string
          accumulatedBusy: string
        }
      }>
    }> | null
    watermarks: Array<{
      __typename?: "VertexWatermarks"
      vertexId: string
      watermarks: Array<{
        __typename?: "WatermarkEntry"
        id: string
        value: string
      }>
    }> | null
    backPressure: Array<{
      __typename?: "VertexBackPressure"
      vertexId: string
      backPressure: {
        __typename?: "BackPressureInfo"
        status: string
        backpressureLevel: string
        endTimestamp: string
        subtasks: Array<{
          __typename?: "SubtaskBackPressure"
          subtask: number
          attemptNumber: number
          backpressureLevel: string
          ratio: number
          busyRatio: number
          idleRatio: number
        }>
      }
    }> | null
    accumulators: Array<{
      __typename?: "VertexAccumulators"
      vertexId: string
      accumulators: Array<{
        __typename?: "UserAccumulator"
        name: string
        type: string
        value: string
      }>
    }> | null
  }
}

export type CancelJobMutationVariables = Exact<{
  id: Scalars["ID"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type CancelJobMutation = {
  __typename?: "Mutation"
  cancelJob: { __typename?: "CancelJobResult"; success: boolean }
}

export type CreateSqlSessionMutationVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type CreateSqlSessionMutation = {
  __typename?: "Mutation"
  createSQLSession: { __typename?: "SQLSessionResult"; sessionHandle: string }
}

export type SubmitStatementMutationVariables = Exact<{
  sessionHandle: Scalars["String"]["input"]
  statement: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type SubmitStatementMutation = {
  __typename?: "Mutation"
  submitStatement: {
    __typename?: "SQLStatementResult"
    operationHandle: string
  }
}

export type FetchSqlResultsMutationVariables = Exact<{
  sessionHandle: Scalars["String"]["input"]
  operationHandle: Scalars["String"]["input"]
  token: InputMaybe<Scalars["String"]["input"]>
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type FetchSqlResultsMutation = {
  __typename?: "Mutation"
  fetchSQLResults: {
    __typename?: "SQLFetchResult"
    rows: Array<Array<string | null> | null>
    hasMore: boolean
    nextToken: string | null
    columns: Array<{ __typename?: "SQLColumn"; name: string; dataType: string }>
  }
}

export type CloseSqlSessionMutationVariables = Exact<{
  sessionHandle: Scalars["String"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type CloseSqlSessionMutation = {
  __typename?: "Mutation"
  closeSQLSession: { __typename?: "SQLCloseResult"; success: boolean }
}

export type TapManifestsQueryVariables = Exact<{ [key: string]: never }>

export type TapManifestsQuery = {
  __typename?: "Query"
  tapManifests: Array<{
    __typename?: "TapManifest"
    name: string
    description: string
    version: string
    config: Record<string, unknown> | null
  }>
}

export type TaskManagersListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type TaskManagersListQuery = {
  __typename?: "Query"
  taskManagers: Array<{
    __typename?: "TaskManagerOverview"
    id: string
    path: string
    dataPort: number
    jmxPort: number
    timeSinceLastHeartbeat: string
    slotsNumber: number
    freeSlots: number
    totalResource: {
      __typename?: "TaskManagerResourceProfile"
      cpuCores: number
      taskHeapMemory: string
      taskOffHeapMemory: string
      managedMemory: string
      networkMemory: string
    }
    freeResource: {
      __typename?: "TaskManagerResourceProfile"
      cpuCores: number
      taskHeapMemory: string
      taskOffHeapMemory: string
      managedMemory: string
      networkMemory: string
    }
    hardware: {
      __typename?: "TaskManagerHardware"
      cpuCores: number
      physicalMemory: string
      freeMemory: string
      managedMemory: string
    }
    memoryConfiguration: {
      __typename?: "TaskManagerMemory"
      frameworkHeap: string
      taskHeap: string
      frameworkOffHeap: string
      taskOffHeap: string
      networkMemory: string
      managedMemory: string
      jvmMetaspace: string
      jvmOverhead: string
      totalFlinkMemory: string
      totalProcessMemory: string
    }
  }>
}

export type TaskManagerDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"]
  cluster: InputMaybe<Scalars["String"]["input"]>
}>

export type TaskManagerDetailQuery = {
  __typename?: "Query"
  taskManager: {
    __typename?: "TaskManagerDetail"
    id: string
    path: string
    dataPort: number
    jmxPort: number
    timeSinceLastHeartbeat: string
    slotsNumber: number
    freeSlots: number
    totalResource: {
      __typename?: "TaskManagerResourceProfile"
      cpuCores: number
      taskHeapMemory: string
      taskOffHeapMemory: string
      managedMemory: string
      networkMemory: string
    }
    freeResource: {
      __typename?: "TaskManagerResourceProfile"
      cpuCores: number
      taskHeapMemory: string
      taskOffHeapMemory: string
      managedMemory: string
      networkMemory: string
    }
    hardware: {
      __typename?: "TaskManagerHardware"
      cpuCores: number
      physicalMemory: string
      freeMemory: string
      managedMemory: string
    }
    memoryConfiguration: {
      __typename?: "TaskManagerMemory"
      frameworkHeap: string
      taskHeap: string
      frameworkOffHeap: string
      taskOffHeap: string
      networkMemory: string
      managedMemory: string
      jvmMetaspace: string
      jvmOverhead: string
      totalFlinkMemory: string
      totalProcessMemory: string
    }
    allocatedSlots: Array<{
      __typename?: "AllocatedSlot"
      index: number
      jobId: string
      resource: {
        __typename?: "TaskManagerResourceProfile"
        cpuCores: number
        taskHeapMemory: string
        taskOffHeapMemory: string
        managedMemory: string
        networkMemory: string
      }
    }>
    metrics: Array<{ __typename?: "MetricEntry"; id: string; value: string }>
  }
}
