export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AllocatedSlot = {
  __typename?: 'AllocatedSlot';
  index: Scalars['Int']['output'];
  jobId: Scalars['String']['output'];
  resource: TaskManagerResourceProfile;
};

export type BackPressureInfo = {
  __typename?: 'BackPressureInfo';
  backpressureLevel: Scalars['String']['output'];
  endTimestamp: Scalars['String']['output'];
  status: Scalars['String']['output'];
  subtasks: Array<SubtaskBackPressure>;
};

export type CancelJobResult = {
  __typename?: 'CancelJobResult';
  success: Scalars['Boolean']['output'];
};

export type CheckpointConfig = {
  __typename?: 'CheckpointConfig';
  externalizedDeleteOnCancellation: Scalars['Boolean']['output'];
  externalizedEnabled: Scalars['Boolean']['output'];
  interval: Scalars['String']['output'];
  maxConcurrent: Scalars['Int']['output'];
  minPause: Scalars['String']['output'];
  mode: Scalars['String']['output'];
  timeout: Scalars['String']['output'];
  unalignedCheckpoints: Scalars['Boolean']['output'];
};

export type CheckpointCounts = {
  __typename?: 'CheckpointCounts';
  completed: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  inProgress: Scalars['Int']['output'];
  restored: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type CheckpointHistoryEntry = {
  __typename?: 'CheckpointHistoryEntry';
  checkpointedSize: Maybe<Scalars['String']['output']>;
  endToEndDuration: Scalars['String']['output'];
  id: Scalars['String']['output'];
  isSavepoint: Scalars['Boolean']['output'];
  latestAckTimestamp: Scalars['String']['output'];
  numAcknowledgedSubtasks: Scalars['Int']['output'];
  numSubtasks: Scalars['Int']['output'];
  persistedData: Scalars['String']['output'];
  processedData: Scalars['String']['output'];
  stateSize: Scalars['String']['output'];
  status: Scalars['String']['output'];
  triggerTimestamp: Scalars['String']['output'];
};

export type CheckpointLatest = {
  __typename?: 'CheckpointLatest';
  completed: Maybe<CheckpointHistoryEntry>;
  failed: Maybe<CheckpointHistoryEntry>;
  restored: Maybe<CheckpointRestoredInfo>;
  savepoint: Maybe<CheckpointHistoryEntry>;
};

export type CheckpointMinMaxAvg = {
  __typename?: 'CheckpointMinMaxAvg';
  avg: Scalars['String']['output'];
  max: Scalars['String']['output'];
  min: Scalars['String']['output'];
};

export type CheckpointRestoredInfo = {
  __typename?: 'CheckpointRestoredInfo';
  externalPath: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  isSavepoint: Scalars['Boolean']['output'];
  restoreTimestamp: Scalars['String']['output'];
};

export type CheckpointStats = {
  __typename?: 'CheckpointStats';
  counts: CheckpointCounts;
  history: Array<CheckpointHistoryEntry>;
  latest: Maybe<CheckpointLatest>;
  summary: Maybe<CheckpointSummary>;
};

export type CheckpointSummary = {
  __typename?: 'CheckpointSummary';
  checkpointedSize: Maybe<CheckpointMinMaxAvg>;
  endToEndDuration: Maybe<CheckpointMinMaxAvg>;
  persistedData: Maybe<CheckpointMinMaxAvg>;
  processedData: Maybe<CheckpointMinMaxAvg>;
  stateSize: Maybe<CheckpointMinMaxAvg>;
};

/** Information about a registered Flink cluster connection. */
export type ClusterInfo = {
  __typename?: 'ClusterInfo';
  lastCheckTime: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  status: ClusterStatus;
  url: Scalars['String']['output'];
  version: Maybe<Scalars['String']['output']>;
};

/** Health status of a registered Flink cluster. */
export type ClusterStatus =
  | 'HEALTHY'
  | 'UNHEALTHY'
  | 'UNKNOWN';

export type DashboardConfig = {
  __typename?: 'DashboardConfig';
  clusters: Array<Scalars['String']['output']>;
  instruments: Array<Scalars['String']['output']>;
};

/**
 * Placeholder types for the database instrument.
 * Future changes will add table browsing, schema inspection, and query preview.
 */
export type DatabaseTable = {
  __typename?: 'DatabaseTable';
  name: Scalars['String']['output'];
  schema: Scalars['String']['output'];
};

export type DeleteResult = {
  __typename?: 'DeleteResult';
  success: Scalars['Boolean']['output'];
};

export type ExceptionEntry = {
  __typename?: 'ExceptionEntry';
  endpoint: Maybe<Scalars['String']['output']>;
  exceptionName: Scalars['String']['output'];
  stacktrace: Scalars['String']['output'];
  taskManagerId: Maybe<Scalars['String']['output']>;
  taskName: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['String']['output'];
};

export type Flamegraph = {
  __typename?: 'Flamegraph';
  data: FlamegraphNode;
  endTimestamp: Scalars['String']['output'];
};

export type FlamegraphNode = {
  __typename?: 'FlamegraphNode';
  children: Maybe<Array<FlamegraphNode>>;
  name: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type FlinkConfig = {
  __typename?: 'FlinkConfig';
  features: FlinkFeatures;
  flinkRevision: Scalars['String']['output'];
  flinkVersion: Scalars['String']['output'];
  refreshInterval: Scalars['Int']['output'];
  timezoneName: Scalars['String']['output'];
  timezoneOffset: Scalars['String']['output'];
};

export type FlinkFeatures = {
  __typename?: 'FlinkFeatures';
  webCancel: Scalars['Boolean']['output'];
  webHistory: Scalars['Boolean']['output'];
  webRescale: Scalars['Boolean']['output'];
  webSubmit: Scalars['Boolean']['output'];
};

/** Information about a registered infrastructure instrument. */
export type InstrumentInfo = {
  __typename?: 'InstrumentInfo';
  capabilities: Array<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  healthy: Scalars['Boolean']['output'];
  lastHealthCheck: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type JmConfigEntry = {
  __typename?: 'JMConfigEntry';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type JmEnvironment = {
  __typename?: 'JMEnvironment';
  classpath: Array<Scalars['String']['output']>;
  jvm: JmEnvironmentJvm;
};

export type JmEnvironmentJvm = {
  __typename?: 'JMEnvironmentJVM';
  arch: Scalars['String']['output'];
  options: Array<Scalars['String']['output']>;
  version: Scalars['String']['output'];
};

export type JarEntryPoint = {
  __typename?: 'JarEntryPoint';
  description: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

export type JarFile = {
  __typename?: 'JarFile';
  entry: Array<JarEntryPoint>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  uploaded: Scalars['String']['output'];
};

export type JarRunResult = {
  __typename?: 'JarRunResult';
  jobId: Scalars['String']['output'];
};

export type JarUploadResult = {
  __typename?: 'JarUploadResult';
  filename: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type JobDetail = {
  __typename?: 'JobDetail';
  accumulators: Maybe<Array<VertexAccumulators>>;
  backPressure: Maybe<Array<VertexBackPressure>>;
  checkpointConfig: Maybe<CheckpointConfig>;
  checkpoints: Maybe<CheckpointStats>;
  duration: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  exceptions: Array<ExceptionEntry>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  now: Scalars['String']['output'];
  plan: JobPlan;
  startTime: Scalars['String']['output'];
  state: Scalars['String']['output'];
  vertexDetails: Maybe<Array<VertexDetail>>;
  vertices: Array<JobVertex>;
  watermarks: Maybe<Array<VertexWatermarks>>;
};

export type JobManagerDetail = {
  __typename?: 'JobManagerDetail';
  config: Array<JmConfigEntry>;
  environment: Maybe<JmEnvironment>;
  metrics: Array<MetricEntry>;
};

export type JobOverview = {
  __typename?: 'JobOverview';
  duration: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastModification: Scalars['String']['output'];
  name: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  state: Scalars['String']['output'];
  tasks: TaskCounts;
};

export type JobPlan = {
  __typename?: 'JobPlan';
  jid: Scalars['String']['output'];
  name: Scalars['String']['output'];
  nodes: Array<PlanNode>;
  type: Scalars['String']['output'];
};

/** A job status transition event emitted when a Flink job changes state. */
export type JobStatusEvent = {
  __typename?: 'JobStatusEvent';
  cluster: Scalars['String']['output'];
  currentStatus: Scalars['String']['output'];
  jobId: Scalars['String']['output'];
  jobName: Scalars['String']['output'];
  previousStatus: Maybe<Scalars['String']['output']>;
};

export type JobVertex = {
  __typename?: 'JobVertex';
  duration: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  maxParallelism: Scalars['Int']['output'];
  metrics: VertexMetrics;
  name: Scalars['String']['output'];
  parallelism: Scalars['Int']['output'];
  startTime: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tasks: TaskCounts;
};

/** A Kafka topic or broker configuration entry. */
export type KafkaConfigEntry = {
  __typename?: 'KafkaConfigEntry';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** Summary of a Kafka consumer group. */
export type KafkaConsumerGroup = {
  __typename?: 'KafkaConsumerGroup';
  groupId: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
  state: Scalars['String']['output'];
  totalLag: Scalars['Int']['output'];
};

/** Detailed information about a Kafka consumer group. */
export type KafkaConsumerGroupDetail = {
  __typename?: 'KafkaConsumerGroupDetail';
  groupId: Scalars['String']['output'];
  members: Array<KafkaGroupMember>;
  offsets: Array<KafkaPartitionOffset>;
  protocol: Scalars['String']['output'];
  protocolType: Scalars['String']['output'];
  state: Scalars['String']['output'];
};

/** A member of a Kafka consumer group. */
export type KafkaGroupMember = {
  __typename?: 'KafkaGroupMember';
  assignments: Array<KafkaTopicPartition>;
  clientHost: Scalars['String']['output'];
  clientId: Scalars['String']['output'];
};

/** A single partition within a Kafka topic. */
export type KafkaPartition = {
  __typename?: 'KafkaPartition';
  id: Scalars['Int']['output'];
  inSyncReplicas: Array<Scalars['Int']['output']>;
  leader: Scalars['Int']['output'];
  replicas: Array<Scalars['Int']['output']>;
};

/** Per-partition offset and lag for a consumer group. */
export type KafkaPartitionOffset = {
  __typename?: 'KafkaPartitionOffset';
  committedOffset: Scalars['Int']['output'];
  endOffset: Scalars['Int']['output'];
  lag: Scalars['Int']['output'];
  partition: Scalars['Int']['output'];
  topic: Scalars['String']['output'];
};

/** Summary of a Kafka topic. */
export type KafkaTopic = {
  __typename?: 'KafkaTopic';
  internal: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  partitionCount: Scalars['Int']['output'];
  replicationFactor: Scalars['Int']['output'];
};

/** Detailed information about a Kafka topic including partitions and config. */
export type KafkaTopicDetail = {
  __typename?: 'KafkaTopicDetail';
  configEntries: Array<KafkaConfigEntry>;
  internal: Scalars['Boolean']['output'];
  messageCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  partitionCount: Scalars['Int']['output'];
  partitions: Array<KafkaPartition>;
  replicationFactor: Scalars['Int']['output'];
};

/** A topic-partition assignment. */
export type KafkaTopicPartition = {
  __typename?: 'KafkaTopicPartition';
  partition: Scalars['Int']['output'];
  topic: Scalars['String']['output'];
};

export type MetricEntry = {
  __typename?: 'MetricEntry';
  id: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Cancel a running job */
  cancelJob: CancelJobResult;
  /** Close a SQL Gateway session */
  closeSQLSession: SqlCloseResult;
  /** Create a new SQL Gateway session */
  createSQLSession: SqlSessionResult;
  /** Delete an uploaded JAR */
  deleteJar: DeleteResult;
  /** Fetch results from a SQL statement execution */
  fetchSQLResults: SqlFetchResult;
  /** Run an uploaded JAR to submit a job */
  runJar: JarRunResult;
  /** Submit a SQL statement to an existing session */
  submitStatement: SqlStatementResult;
};


export type MutationCancelJobArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationCloseSqlSessionArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  sessionHandle: Scalars['String']['input'];
};


export type MutationCreateSqlSessionArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type MutationDeleteJarArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationFetchSqlResultsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  operationHandle: Scalars['String']['input'];
  sessionHandle: Scalars['String']['input'];
  token: InputMaybe<Scalars['String']['input']>;
};


export type MutationRunJarArgs = {
  allowNonRestoredState: InputMaybe<Scalars['Boolean']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
  entryClass: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  parallelism: InputMaybe<Scalars['Int']['input']>;
  programArgs: InputMaybe<Scalars['String']['input']>;
  savepointPath: InputMaybe<Scalars['String']['input']>;
};


export type MutationSubmitStatementArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  sessionHandle: Scalars['String']['input'];
  statement: Scalars['String']['input'];
};

export type PlanNode = {
  __typename?: 'PlanNode';
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  inputs: Maybe<Array<PlanNodeInput>>;
  operator: Scalars['String']['output'];
  operatorStrategy: Scalars['String']['output'];
  parallelism: Scalars['Int']['output'];
};

export type PlanNodeInput = {
  __typename?: 'PlanNodeInput';
  exchange: Scalars['String']['output'];
  id: Scalars['String']['output'];
  num: Scalars['Int']['output'];
  shipStrategy: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Get checkpoint detail */
  checkpointDetail: CheckpointHistoryEntry;
  clusters: Array<ClusterInfo>;
  /** Get dashboard configuration (available clusters and instruments) */
  dashboardConfig: DashboardConfig;
  /** List tables for a database instrument (stub — not yet implemented). */
  databaseTables: Array<DatabaseTable>;
  /** Get flamegraph for a vertex */
  flamegraph: Flamegraph;
  /** Get Flink cluster configuration */
  flinkConfig: FlinkConfig;
  health: Scalars['Boolean']['output'];
  /** List all registered instruments with their health status and capabilities. */
  instruments: Array<InstrumentInfo>;
  /** List all uploaded JARs */
  jars: Array<JarFile>;
  /** Get detailed job information including vertices, checkpoints, exceptions */
  job: JobDetail;
  /** Get job manager config, environment, and metrics */
  jobManager: JobManagerDetail;
  /** List all jobs in a cluster */
  jobs: Array<JobOverview>;
  /** Get detailed information about a specific consumer group. */
  kafkaConsumerGroup: KafkaConsumerGroupDetail;
  /** List consumer groups for a Kafka instrument. */
  kafkaConsumerGroups: Array<KafkaConsumerGroup>;
  /** Get detailed information about a specific Kafka topic. */
  kafkaTopic: KafkaTopicDetail;
  /** List topics for a Kafka instrument. */
  kafkaTopics: Array<KafkaTopic>;
  /** Get subtask times for a vertex */
  subtaskTimes: SubtaskTimes;
  /** List all loaded tap pipeline manifests */
  tapManifests: Array<TapManifest>;
  /** Get detailed task manager info with metrics */
  taskManager: TaskManagerDetail;
  /** Get task manager logs list */
  taskManagerLogs: Array<TmLogEntry>;
  /** Get task manager thread dump */
  taskManagerThreadDump: Array<ThreadDumpEntry>;
  /** List all task managers in a cluster */
  taskManagers: Array<TaskManagerOverview>;
  /** Get vertex detail with subtask info */
  vertexDetail: VertexDetail;
};


export type QueryCheckpointDetailArgs = {
  checkpointId: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
};


export type QueryDatabaseTablesArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryFlamegraphArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  type: Scalars['String']['input'];
  vertexId: Scalars['ID']['input'];
};


export type QueryFlinkConfigArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJarsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryJobManagerArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryKafkaConsumerGroupArgs = {
  groupId: Scalars['String']['input'];
  instrument: Scalars['String']['input'];
};


export type QueryKafkaConsumerGroupsArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryKafkaTopicArgs = {
  instrument: Scalars['String']['input'];
  name: Scalars['String']['input'];
};


export type QueryKafkaTopicsArgs = {
  instrument: Scalars['String']['input'];
};


export type QuerySubtaskTimesArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  vertexId: Scalars['ID']['input'];
};


export type QueryTaskManagerArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryTaskManagerLogsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryTaskManagerThreadDumpArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryTaskManagersArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryVertexDetailArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  vertexId: Scalars['ID']['input'];
};

export type SqlCloseResult = {
  __typename?: 'SQLCloseResult';
  success: Scalars['Boolean']['output'];
};

/** A column descriptor from SQL Gateway results. */
export type SqlColumn = {
  __typename?: 'SQLColumn';
  dataType: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type SqlFetchResult = {
  __typename?: 'SQLFetchResult';
  columns: Array<SqlColumn>;
  hasMore: Scalars['Boolean']['output'];
  nextToken: Maybe<Scalars['String']['output']>;
  rows: Array<Maybe<Array<Maybe<Scalars['String']['output']>>>>;
};

/** A batch of SQL Gateway query results. */
export type SqlResultBatch = {
  __typename?: 'SQLResultBatch';
  columns: Array<SqlColumn>;
  hasMore: Scalars['Boolean']['output'];
  rows: Array<Maybe<Array<Maybe<Scalars['String']['output']>>>>;
};

export type SqlSessionResult = {
  __typename?: 'SQLSessionResult';
  sessionHandle: Scalars['String']['output'];
};

export type SqlStatementResult = {
  __typename?: 'SQLStatementResult';
  operationHandle: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /**
   * Emits a JobStatusEvent whenever any Flink job's status changes.
   * Optionally scoped to a specific cluster.
   */
  jobStatusChanged: JobStatusEvent;
  /** Streams result batches from a SQL Gateway operation. */
  sqlResults: SqlResultBatch;
};


export type SubscriptionJobStatusChangedArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionSqlResultsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  operationHandle: Scalars['String']['input'];
  sessionHandle: Scalars['String']['input'];
};

export type SubtaskBackPressure = {
  __typename?: 'SubtaskBackPressure';
  attemptNumber: Scalars['Int']['output'];
  backpressureLevel: Scalars['String']['output'];
  busyRatio: Scalars['Float']['output'];
  idleRatio: Scalars['Float']['output'];
  ratio: Scalars['Float']['output'];
  subtask: Scalars['Int']['output'];
};

export type SubtaskInfo = {
  __typename?: 'SubtaskInfo';
  attempt: Scalars['Int']['output'];
  duration: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  endpoint: Scalars['String']['output'];
  metrics: VertexMetrics;
  startTime: Scalars['String']['output'];
  status: Scalars['String']['output'];
  subtask: Scalars['Int']['output'];
  taskManagerId: Scalars['String']['output'];
};

export type SubtaskTimes = {
  __typename?: 'SubtaskTimes';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  now: Scalars['String']['output'];
  subtasks: Array<SubtaskTimesEntry>;
};

export type SubtaskTimesEntry = {
  __typename?: 'SubtaskTimesEntry';
  duration: Scalars['String']['output'];
  host: Scalars['String']['output'];
  subtask: Scalars['Int']['output'];
  timestamps: Array<TimestampEntry>;
};

export type TmLogEntry = {
  __typename?: 'TMLogEntry';
  name: Scalars['String']['output'];
  size: Scalars['String']['output'];
};

export type TapManifest = {
  __typename?: 'TapManifest';
  config: Maybe<Scalars['JSON']['output']>;
  description: Scalars['String']['output'];
  name: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type TaskCounts = {
  __typename?: 'TaskCounts';
  canceled: Scalars['Int']['output'];
  canceling: Scalars['Int']['output'];
  created: Scalars['Int']['output'];
  deploying: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  finished: Scalars['Int']['output'];
  initializing: Scalars['Int']['output'];
  reconciling: Scalars['Int']['output'];
  running: Scalars['Int']['output'];
  scheduled: Scalars['Int']['output'];
};

export type TaskManagerDetail = {
  __typename?: 'TaskManagerDetail';
  allocatedSlots: Array<AllocatedSlot>;
  dataPort: Scalars['Int']['output'];
  freeResource: TaskManagerResourceProfile;
  freeSlots: Scalars['Int']['output'];
  hardware: TaskManagerHardware;
  id: Scalars['ID']['output'];
  jmxPort: Scalars['Int']['output'];
  memoryConfiguration: TaskManagerMemory;
  metrics: Array<MetricEntry>;
  path: Scalars['String']['output'];
  slotsNumber: Scalars['Int']['output'];
  timeSinceLastHeartbeat: Scalars['String']['output'];
  totalResource: TaskManagerResourceProfile;
};

export type TaskManagerHardware = {
  __typename?: 'TaskManagerHardware';
  cpuCores: Scalars['Int']['output'];
  freeMemory: Scalars['String']['output'];
  managedMemory: Scalars['String']['output'];
  physicalMemory: Scalars['String']['output'];
};

export type TaskManagerMemory = {
  __typename?: 'TaskManagerMemory';
  frameworkHeap: Scalars['String']['output'];
  frameworkOffHeap: Scalars['String']['output'];
  jvmMetaspace: Scalars['String']['output'];
  jvmOverhead: Scalars['String']['output'];
  managedMemory: Scalars['String']['output'];
  networkMemory: Scalars['String']['output'];
  taskHeap: Scalars['String']['output'];
  taskOffHeap: Scalars['String']['output'];
  totalFlinkMemory: Scalars['String']['output'];
  totalProcessMemory: Scalars['String']['output'];
};

export type TaskManagerOverview = {
  __typename?: 'TaskManagerOverview';
  dataPort: Scalars['Int']['output'];
  freeResource: TaskManagerResourceProfile;
  freeSlots: Scalars['Int']['output'];
  hardware: TaskManagerHardware;
  id: Scalars['ID']['output'];
  jmxPort: Scalars['Int']['output'];
  memoryConfiguration: TaskManagerMemory;
  path: Scalars['String']['output'];
  slotsNumber: Scalars['Int']['output'];
  timeSinceLastHeartbeat: Scalars['String']['output'];
  totalResource: TaskManagerResourceProfile;
};

export type TaskManagerResourceProfile = {
  __typename?: 'TaskManagerResourceProfile';
  cpuCores: Scalars['Float']['output'];
  managedMemory: Scalars['String']['output'];
  networkMemory: Scalars['String']['output'];
  taskHeapMemory: Scalars['String']['output'];
  taskOffHeapMemory: Scalars['String']['output'];
};

export type ThreadDumpEntry = {
  __typename?: 'ThreadDumpEntry';
  stringifiedThreadInfo: Scalars['String']['output'];
  threadName: Scalars['String']['output'];
};

export type TimestampEntry = {
  __typename?: 'TimestampEntry';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type UserAccumulator = {
  __typename?: 'UserAccumulator';
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type VertexAccumulators = {
  __typename?: 'VertexAccumulators';
  accumulators: Array<UserAccumulator>;
  vertexId: Scalars['ID']['output'];
};

export type VertexBackPressure = {
  __typename?: 'VertexBackPressure';
  backPressure: BackPressureInfo;
  vertexId: Scalars['ID']['output'];
};

export type VertexDetail = {
  __typename?: 'VertexDetail';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  now: Scalars['String']['output'];
  parallelism: Scalars['Int']['output'];
  subtasks: Array<SubtaskInfo>;
};

export type VertexMetrics = {
  __typename?: 'VertexMetrics';
  accumulatedBackpressured: Scalars['String']['output'];
  accumulatedBusy: Scalars['String']['output'];
  accumulatedIdle: Scalars['String']['output'];
  readBytes: Scalars['String']['output'];
  readBytesComplete: Scalars['Boolean']['output'];
  readRecords: Scalars['String']['output'];
  readRecordsComplete: Scalars['Boolean']['output'];
  writeBytes: Scalars['String']['output'];
  writeBytesComplete: Scalars['Boolean']['output'];
  writeRecords: Scalars['String']['output'];
  writeRecordsComplete: Scalars['Boolean']['output'];
};

export type VertexWatermarks = {
  __typename?: 'VertexWatermarks';
  vertexId: Scalars['ID']['output'];
  watermarks: Array<WatermarkEntry>;
};

export type WatermarkEntry = {
  __typename?: 'WatermarkEntry';
  id: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type CheckpointDetailQueryVariables = Exact<{
  jobId: Scalars['ID']['input'];
  checkpointId: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CheckpointDetailQuery = { __typename?: 'Query', checkpointDetail: { __typename?: 'CheckpointHistoryEntry', id: string, status: string, isSavepoint: boolean, triggerTimestamp: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, processedData: string, persistedData: string, numSubtasks: number, numAcknowledgedSubtasks: number, checkpointedSize: string | null } };

export type ClusterOverviewQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type ClusterOverviewQuery = { __typename?: 'Query', clusters: Array<{ __typename?: 'ClusterInfo', name: string, url: string, status: ClusterStatus, lastCheckTime: string | null, version: string | null }>, jobs: Array<{ __typename?: 'JobOverview', id: string, name: string, state: string, startTime: string, endTime: string, duration: string, lastModification: string, tasks: { __typename?: 'TaskCounts', created: number, scheduled: number, deploying: number, running: number, finished: number, canceling: number, canceled: number, failed: number, reconciling: number, initializing: number } }> };

export type FlinkConfigQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type FlinkConfigQuery = { __typename?: 'Query', flinkConfig: { __typename?: 'FlinkConfig', refreshInterval: number, timezoneName: string, timezoneOffset: string, flinkVersion: string, flinkRevision: string, features: { __typename?: 'FlinkFeatures', webSubmit: boolean, webCancel: boolean, webRescale: boolean, webHistory: boolean } } };

export type DashboardConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type DashboardConfigQuery = { __typename?: 'Query', dashboardConfig: { __typename?: 'DashboardConfig', clusters: Array<string>, instruments: Array<string> } };

export type JarsListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JarsListQuery = { __typename?: 'Query', jars: Array<{ __typename?: 'JarFile', id: string, name: string, uploaded: string, entry: Array<{ __typename?: 'JarEntryPoint', name: string, description: string | null }> }> };

export type DeleteJarMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type DeleteJarMutation = { __typename?: 'Mutation', deleteJar: { __typename?: 'DeleteResult', success: boolean } };

export type RunJarMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  entryClass: InputMaybe<Scalars['String']['input']>;
  programArgs: InputMaybe<Scalars['String']['input']>;
  parallelism: InputMaybe<Scalars['Int']['input']>;
  savepointPath: InputMaybe<Scalars['String']['input']>;
  allowNonRestoredState: InputMaybe<Scalars['Boolean']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type RunJarMutation = { __typename?: 'Mutation', runJar: { __typename?: 'JarRunResult', jobId: string } };

export type JobManagerDetailQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobManagerDetailQuery = { __typename?: 'Query', jobManager: { __typename?: 'JobManagerDetail', config: Array<{ __typename?: 'JMConfigEntry', key: string, value: string }>, environment: { __typename?: 'JMEnvironment', classpath: Array<string>, jvm: { __typename?: 'JMEnvironmentJVM', version: string, arch: string, options: Array<string> } } | null, metrics: Array<{ __typename?: 'MetricEntry', id: string, value: string }> } };

export type JobsListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobsListQuery = { __typename?: 'Query', jobs: Array<{ __typename?: 'JobOverview', id: string, name: string, state: string, startTime: string, endTime: string, duration: string, lastModification: string, tasks: { __typename?: 'TaskCounts', created: number, scheduled: number, deploying: number, running: number, finished: number, canceling: number, canceled: number, failed: number, reconciling: number, initializing: number } }> };

export type JobDetailQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobDetailQuery = { __typename?: 'Query', job: { __typename?: 'JobDetail', id: string, name: string, state: string, startTime: string, endTime: string, duration: string, now: string, vertices: Array<{ __typename?: 'JobVertex', id: string, name: string, maxParallelism: number, parallelism: number, status: string, startTime: string, endTime: string, duration: string, tasks: { __typename?: 'TaskCounts', created: number, scheduled: number, deploying: number, running: number, finished: number, canceling: number, canceled: number, failed: number, reconciling: number, initializing: number }, metrics: { __typename?: 'VertexMetrics', readBytes: string, readBytesComplete: boolean, writeBytes: string, writeBytesComplete: boolean, readRecords: string, readRecordsComplete: boolean, writeRecords: string, writeRecordsComplete: boolean, accumulatedBackpressured: string, accumulatedIdle: string, accumulatedBusy: string } }>, plan: { __typename?: 'JobPlan', jid: string, name: string, type: string, nodes: Array<{ __typename?: 'PlanNode', id: string, parallelism: number, operator: string, operatorStrategy: string, description: string, inputs: Array<{ __typename?: 'PlanNodeInput', num: number, id: string, shipStrategy: string, exchange: string }> | null }> }, exceptions: Array<{ __typename?: 'ExceptionEntry', exceptionName: string, stacktrace: string, timestamp: string, taskName: string | null, endpoint: string | null, taskManagerId: string | null }>, checkpoints: { __typename?: 'CheckpointStats', counts: { __typename?: 'CheckpointCounts', completed: number, inProgress: number, failed: number, total: number, restored: number }, history: Array<{ __typename?: 'CheckpointHistoryEntry', id: string, status: string, isSavepoint: boolean, triggerTimestamp: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, processedData: string, persistedData: string, numSubtasks: number, numAcknowledgedSubtasks: number, checkpointedSize: string | null }>, summary: { __typename?: 'CheckpointSummary', stateSize: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, endToEndDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, checkpointedSize: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null } | null, latest: { __typename?: 'CheckpointLatest', completed: { __typename?: 'CheckpointHistoryEntry', id: string, status: string, triggerTimestamp: string, stateSize: string, endToEndDuration: string } | null, restored: { __typename?: 'CheckpointRestoredInfo', id: string, restoreTimestamp: string, isSavepoint: boolean, externalPath: string | null } | null } | null } | null, checkpointConfig: { __typename?: 'CheckpointConfig', mode: string, interval: string, timeout: string, minPause: string, maxConcurrent: number, externalizedEnabled: boolean, externalizedDeleteOnCancellation: boolean, unalignedCheckpoints: boolean } | null, vertexDetails: Array<{ __typename?: 'VertexDetail', id: string, name: string, parallelism: number, now: string, subtasks: Array<{ __typename?: 'SubtaskInfo', subtask: number, status: string, attempt: number, endpoint: string, startTime: string, endTime: string, duration: string, taskManagerId: string, metrics: { __typename?: 'VertexMetrics', readBytes: string, readBytesComplete: boolean, writeBytes: string, writeBytesComplete: boolean, readRecords: string, readRecordsComplete: boolean, writeRecords: string, writeRecordsComplete: boolean, accumulatedBackpressured: string, accumulatedIdle: string, accumulatedBusy: string } }> }> | null, watermarks: Array<{ __typename?: 'VertexWatermarks', vertexId: string, watermarks: Array<{ __typename?: 'WatermarkEntry', id: string, value: string }> }> | null, backPressure: Array<{ __typename?: 'VertexBackPressure', vertexId: string, backPressure: { __typename?: 'BackPressureInfo', status: string, backpressureLevel: string, endTimestamp: string, subtasks: Array<{ __typename?: 'SubtaskBackPressure', subtask: number, attemptNumber: number, backpressureLevel: string, ratio: number, busyRatio: number, idleRatio: number }> } }> | null, accumulators: Array<{ __typename?: 'VertexAccumulators', vertexId: string, accumulators: Array<{ __typename?: 'UserAccumulator', name: string, type: string, value: string }> }> | null } };

export type CancelJobMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CancelJobMutation = { __typename?: 'Mutation', cancelJob: { __typename?: 'CancelJobResult', success: boolean } };

export type CreateSqlSessionMutationVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateSqlSessionMutation = { __typename?: 'Mutation', createSQLSession: { __typename?: 'SQLSessionResult', sessionHandle: string } };

export type SubmitStatementMutationVariables = Exact<{
  sessionHandle: Scalars['String']['input'];
  statement: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type SubmitStatementMutation = { __typename?: 'Mutation', submitStatement: { __typename?: 'SQLStatementResult', operationHandle: string } };

export type FetchSqlResultsMutationVariables = Exact<{
  sessionHandle: Scalars['String']['input'];
  operationHandle: Scalars['String']['input'];
  token: InputMaybe<Scalars['String']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type FetchSqlResultsMutation = { __typename?: 'Mutation', fetchSQLResults: { __typename?: 'SQLFetchResult', rows: Array<Array<string | null> | null>, hasMore: boolean, nextToken: string | null, columns: Array<{ __typename?: 'SQLColumn', name: string, dataType: string }> } };

export type CloseSqlSessionMutationVariables = Exact<{
  sessionHandle: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CloseSqlSessionMutation = { __typename?: 'Mutation', closeSQLSession: { __typename?: 'SQLCloseResult', success: boolean } };

export type TapManifestsQueryVariables = Exact<{ [key: string]: never; }>;


export type TapManifestsQuery = { __typename?: 'Query', tapManifests: Array<{ __typename?: 'TapManifest', name: string, description: string, version: string, config: Record<string, unknown> | null }> };

export type TaskManagersListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type TaskManagersListQuery = { __typename?: 'Query', taskManagers: Array<{ __typename?: 'TaskManagerOverview', id: string, path: string, dataPort: number, jmxPort: number, timeSinceLastHeartbeat: string, slotsNumber: number, freeSlots: number, totalResource: { __typename?: 'TaskManagerResourceProfile', cpuCores: number, taskHeapMemory: string, taskOffHeapMemory: string, managedMemory: string, networkMemory: string }, freeResource: { __typename?: 'TaskManagerResourceProfile', cpuCores: number, taskHeapMemory: string, taskOffHeapMemory: string, managedMemory: string, networkMemory: string }, hardware: { __typename?: 'TaskManagerHardware', cpuCores: number, physicalMemory: string, freeMemory: string, managedMemory: string }, memoryConfiguration: { __typename?: 'TaskManagerMemory', frameworkHeap: string, taskHeap: string, frameworkOffHeap: string, taskOffHeap: string, networkMemory: string, managedMemory: string, jvmMetaspace: string, jvmOverhead: string, totalFlinkMemory: string, totalProcessMemory: string } }> };

export type TaskManagerDetailQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type TaskManagerDetailQuery = { __typename?: 'Query', taskManager: { __typename?: 'TaskManagerDetail', id: string, path: string, dataPort: number, jmxPort: number, timeSinceLastHeartbeat: string, slotsNumber: number, freeSlots: number, totalResource: { __typename?: 'TaskManagerResourceProfile', cpuCores: number, taskHeapMemory: string, taskOffHeapMemory: string, managedMemory: string, networkMemory: string }, freeResource: { __typename?: 'TaskManagerResourceProfile', cpuCores: number, taskHeapMemory: string, taskOffHeapMemory: string, managedMemory: string, networkMemory: string }, hardware: { __typename?: 'TaskManagerHardware', cpuCores: number, physicalMemory: string, freeMemory: string, managedMemory: string }, memoryConfiguration: { __typename?: 'TaskManagerMemory', frameworkHeap: string, taskHeap: string, frameworkOffHeap: string, taskOffHeap: string, networkMemory: string, managedMemory: string, jvmMetaspace: string, jvmOverhead: string, totalFlinkMemory: string, totalProcessMemory: string }, allocatedSlots: Array<{ __typename?: 'AllocatedSlot', index: number, jobId: string, resource: { __typename?: 'TaskManagerResourceProfile', cpuCores: number, taskHeapMemory: string, taskOffHeapMemory: string, managedMemory: string, networkMemory: string } }>, metrics: Array<{ __typename?: 'MetricEntry', id: string, value: string }> } };
