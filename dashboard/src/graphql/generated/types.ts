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

/** Acknowledgement record for an alert instance. */
export type AlertAck = {
  __typename?: 'AlertAck';
  ackAt: Scalars['String']['output'];
  ackBy: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  instanceId: Scalars['ID']['output'];
  note: Scalars['String']['output'];
};

/** Structured condition payload stored on an alert rule. */
export type AlertCondition = {
  __typename?: 'AlertCondition';
  threshold: Scalars['Float']['output'];
  type: AlertConditionType;
  windowSec: Maybe<Scalars['Int']['output']>;
};

export type AlertConditionInput = {
  threshold: Scalars['Float']['input'];
  type: AlertConditionType;
  windowSec: InputMaybe<Scalars['Int']['input']>;
};

/** Alert rule condition type. v1 enum. */
export type AlertConditionType =
  | 'BACKPRESSURE'
  | 'CHECKPOINT_FAILURE'
  | 'CHECKPOINT_SIZE_GROWTH'
  | 'GC_PRESSURE'
  | 'PROCESS_MEMORY_HEADROOM'
  | 'SLOT_EXHAUSTION'
  | 'TM_LOST'
  | 'TM_MEMORY';

export type AlertHistoryFilterInput = {
  after: InputMaybe<Scalars['String']['input']>;
  before: InputMaybe<Scalars['String']['input']>;
  limit: InputMaybe<Scalars['Int']['input']>;
  offset: InputMaybe<Scalars['Int']['input']>;
  ruleId: InputMaybe<Scalars['ID']['input']>;
  state: InputMaybe<AlertState>;
};

export type AlertHistoryPage = {
  __typename?: 'AlertHistoryPage';
  instances: Array<AlertInstance>;
  total: Scalars['Int']['output'];
};

/** A single firing/acknowledged/resolved alert occurrence. */
export type AlertInstance = {
  __typename?: 'AlertInstance';
  contextJson: Scalars['String']['output'];
  currentValue: Maybe<Scalars['Float']['output']>;
  dedupKey: Scalars['String']['output'];
  firedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastSeenAt: Scalars['String']['output'];
  message: Scalars['String']['output'];
  resolvedAt: Maybe<Scalars['String']['output']>;
  rule: Maybe<AlertRule>;
  ruleId: Scalars['ID']['output'];
  state: AlertState;
};

/** A configured alert rule. */
export type AlertRule = {
  __typename?: 'AlertRule';
  condition: AlertCondition;
  createdAt: Scalars['String']['output'];
  description: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isPreset: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  owner: Scalars['String']['output'];
  severity: AlertSeverity;
  updatedAt: Scalars['String']['output'];
};

export type AlertSeverity =
  | 'critical'
  | 'info'
  | 'warning';

export type AlertState =
  | 'ACKNOWLEDGED'
  | 'FIRING'
  | 'RESOLVED'
  | 'SILENCED';

export type AllocatedSlot = {
  __typename?: 'AllocatedSlot';
  index: Scalars['Int']['output'];
  jobId: Scalars['String']['output'];
  resource: TaskManagerResourceProfile;
};

/** A Flink application in the cluster→application→job hierarchy (Flink 2.3+, FLIP-549). */
export type Application = {
  __typename?: 'Application';
  id: Scalars['ID']['output'];
  /** Number of jobs belonging to this application. */
  jobCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  /** Epoch-millis timestamp the application started. Null when unknown. */
  startTime: Maybe<Scalars['String']['output']>;
  state: Scalars['String']['output'];
};

export type BackPressureInfo = {
  __typename?: 'BackPressureInfo';
  backpressureLevel: Scalars['String']['output'];
  endTimestamp: Scalars['String']['output'];
  status: Scalars['String']['output'];
  subtasks: Array<SubtaskBackPressure>;
};

export type BlueGreenConfigDiff = {
  __typename?: 'BlueGreenConfigDiff';
  blueYAML: Scalars['String']['output'];
  greenYAML: Scalars['String']['output'];
};

export type BlueGreenDeployment = {
  __typename?: 'BlueGreenDeployment';
  abortGracePeriod: Maybe<Scalars['String']['output']>;
  abortTimestamp: Maybe<Scalars['String']['output']>;
  activeJobId: Maybe<Scalars['String']['output']>;
  blueDeploymentName: Maybe<Scalars['String']['output']>;
  deploymentDeletionDelay: Maybe<Scalars['String']['output']>;
  deploymentReadyTimestamp: Maybe<Scalars['String']['output']>;
  error: Maybe<Scalars['String']['output']>;
  greenDeploymentName: Maybe<Scalars['String']['output']>;
  jobStatus: Maybe<Scalars['String']['output']>;
  lastReconciledTimestamp: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  namespace: Scalars['String']['output'];
  pendingJobId: Maybe<Scalars['String']['output']>;
  state: BlueGreenState;
};

export type BlueGreenState =
  | 'ACTIVE_BLUE'
  | 'ACTIVE_GREEN'
  | 'INITIALIZING_BLUE'
  | 'SAVEPOINTING_BLUE'
  | 'SAVEPOINTING_GREEN'
  | 'TRANSITIONING_TO_BLUE'
  | 'TRANSITIONING_TO_GREEN';

export type CancelApplicationResult = {
  __typename?: 'CancelApplicationResult';
  success: Scalars['Boolean']['output'];
};

export type CancelJobResult = {
  __typename?: 'CancelJobResult';
  success: Scalars['Boolean']['output'];
};

export type CatalogDatabase = {
  __typename?: 'CatalogDatabase';
  name: Scalars['String']['output'];
};

export type CatalogInfo = {
  __typename?: 'CatalogInfo';
  connectorType: Scalars['String']['output'];
  databaseCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  properties: Maybe<Scalars['JSON']['output']>;
  source: Scalars['String']['output'];
  tableCount: Scalars['Int']['output'];
};

export type CatalogTable = {
  __typename?: 'CatalogTable';
  name: Scalars['String']['output'];
};

export type CheckpointConfig = {
  __typename?: 'CheckpointConfig';
  alignedCheckpointTimeout: Maybe<Scalars['String']['output']>;
  /** Checkpoint storage, e.g. FileSystemCheckpointStorage. Absent on older Flink. */
  checkpointStorage: Maybe<Scalars['String']['output']>;
  checkpointsAfterTasksFinish: Maybe<Scalars['Boolean']['output']>;
  externalizedDeleteOnCancellation: Scalars['Boolean']['output'];
  externalizedEnabled: Scalars['Boolean']['output'];
  interval: Scalars['String']['output'];
  maxConcurrent: Scalars['Int']['output'];
  minPause: Scalars['String']['output'];
  mode: Scalars['String']['output'];
  /** State backend class name, e.g. HashMapStateBackend. Absent on older Flink. */
  stateBackend: Maybe<Scalars['String']['output']>;
  timeout: Scalars['String']['output'];
  tolerableFailedCheckpoints: Maybe<Scalars['Int']['output']>;
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

/**
 * Full detail for a single checkpoint
 * (GET /jobs/:jid/checkpoints/details/:checkpointid).
 */
export type CheckpointDetail = {
  __typename?: 'CheckpointDetail';
  /** CHECKPOINT, UNALIGNED_CHECKPOINT, SAVEPOINT, or SYNC_SAVEPOINT. */
  checkpointType: Maybe<Scalars['String']['output']>;
  checkpointedSize: Maybe<Scalars['String']['output']>;
  discarded: Maybe<Scalars['Boolean']['output']>;
  endToEndDuration: Scalars['String']['output'];
  /** Restore location. Null unless the checkpoint is externally addressable. */
  externalPath: Maybe<Scalars['String']['output']>;
  /** Failure reason. Null unless status is FAILED. */
  failureMessage: Maybe<Scalars['String']['output']>;
  /** Failure time (epoch millis). Null unless status is FAILED. */
  failureTimestamp: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  isSavepoint: Scalars['Boolean']['output'];
  latestAckTimestamp: Scalars['String']['output'];
  numAcknowledgedSubtasks: Scalars['Int']['output'];
  numSubtasks: Scalars['Int']['output'];
  persistedData: Maybe<Scalars['String']['output']>;
  processedData: Maybe<Scalars['String']['output']>;
  stateSize: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tasks: Array<CheckpointTaskDetail>;
  triggerTimestamp: Scalars['String']['output'];
};

/** Connection type for paginated checkpoint history results. */
export type CheckpointHistoryConnection = {
  __typename?: 'CheckpointHistoryConnection';
  /** List of checkpoint history edges. */
  edges: Array<CheckpointHistoryEdge>;
  /** Pagination metadata. */
  pageInfo: CheckpointHistoryPageInfo;
};

/** A single edge in the checkpoint history connection. */
export type CheckpointHistoryEdge = {
  __typename?: 'CheckpointHistoryEdge';
  /** Opaque cursor for this edge. */
  cursor: Scalars['String']['output'];
  /** The checkpoint record. */
  node: StoredCheckpoint;
};

export type CheckpointHistoryEntry = {
  __typename?: 'CheckpointHistoryEntry';
  /** CHECKPOINT, UNALIGNED_CHECKPOINT, SAVEPOINT, or SYNC_SAVEPOINT. */
  checkpointType: Maybe<Scalars['String']['output']>;
  checkpointedSize: Maybe<Scalars['String']['output']>;
  endToEndDuration: Scalars['String']['output'];
  /** Restore location. Null unless the checkpoint is externally addressable. */
  externalPath: Maybe<Scalars['String']['output']>;
  /** Failure reason. Null unless status is FAILED. */
  failureMessage: Maybe<Scalars['String']['output']>;
  /** Failure time (epoch millis). Null unless status is FAILED. */
  failureTimestamp: Maybe<Scalars['String']['output']>;
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

/** Filter criteria for historical checkpoint queries. */
export type CheckpointHistoryFilter = {
  /** Return only checkpoints with trigger_timestamp >= this timestamp. */
  after: InputMaybe<Scalars['String']['input']>;
  /** Return only checkpoints with trigger_timestamp <= this timestamp. */
  before: InputMaybe<Scalars['String']['input']>;
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars['String']['input']>;
  /** Filter to savepoints only. */
  isSavepoint: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by job ID. */
  jobID: InputMaybe<Scalars['String']['input']>;
  /** Filter by checkpoint status (e.g. COMPLETED, FAILED, IN_PROGRESS). */
  status: InputMaybe<Scalars['String']['input']>;
};

/** Page info for checkpoint history pagination. */
export type CheckpointHistoryPageInfo = {
  __typename?: 'CheckpointHistoryPageInfo';
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars['String']['output']>;
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars['Boolean']['output'];
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

/**
 * One subtask's checkpoint stats. Subtasks that have not acknowledged carry
 * only index and status.
 */
export type CheckpointSubtaskEntry = {
  __typename?: 'CheckpointSubtaskEntry';
  aborted: Maybe<Scalars['Boolean']['output']>;
  ackTimestamp: Maybe<Scalars['String']['output']>;
  alignmentBuffered: Maybe<Scalars['String']['output']>;
  alignmentDuration: Maybe<Scalars['String']['output']>;
  alignmentPersisted: Maybe<Scalars['String']['output']>;
  alignmentProcessed: Maybe<Scalars['String']['output']>;
  asyncDuration: Maybe<Scalars['String']['output']>;
  checkpointedSize: Maybe<Scalars['String']['output']>;
  endToEndDuration: Maybe<Scalars['String']['output']>;
  index: Scalars['Int']['output'];
  startDelay: Maybe<Scalars['String']['output']>;
  stateSize: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  syncDuration: Maybe<Scalars['String']['output']>;
  unalignedCheckpoint: Maybe<Scalars['Boolean']['output']>;
};

/**
 * Per-subtask checkpoint stats for one vertex of a checkpoint
 * (GET /jobs/:jid/checkpoints/details/:checkpointid/subtasks/:vertexid).
 */
export type CheckpointSubtaskStats = {
  __typename?: 'CheckpointSubtaskStats';
  endToEndDuration: Scalars['String']['output'];
  latestAckTimestamp: Scalars['String']['output'];
  numAcknowledgedSubtasks: Scalars['Int']['output'];
  numSubtasks: Scalars['Int']['output'];
  stateSize: Scalars['String']['output'];
  status: Scalars['String']['output'];
  subtasks: Array<CheckpointSubtaskEntry>;
  summary: Maybe<CheckpointSubtaskSummary>;
  vertexId: Scalars['String']['output'];
};

/** Min/avg/max rollups for one vertex's subtask checkpoint stats. */
export type CheckpointSubtaskSummary = {
  __typename?: 'CheckpointSubtaskSummary';
  alignmentBuffered: Maybe<CheckpointMinMaxAvg>;
  alignmentDuration: Maybe<CheckpointMinMaxAvg>;
  alignmentPersisted: Maybe<CheckpointMinMaxAvg>;
  alignmentProcessed: Maybe<CheckpointMinMaxAvg>;
  asyncDuration: Maybe<CheckpointMinMaxAvg>;
  checkpointedSize: Maybe<CheckpointMinMaxAvg>;
  endToEndDuration: Maybe<CheckpointMinMaxAvg>;
  startDelay: Maybe<CheckpointMinMaxAvg>;
  stateSize: Maybe<CheckpointMinMaxAvg>;
  syncDuration: Maybe<CheckpointMinMaxAvg>;
};

export type CheckpointSummary = {
  __typename?: 'CheckpointSummary';
  checkpointedSize: Maybe<CheckpointMinMaxAvg>;
  endToEndDuration: Maybe<CheckpointMinMaxAvg>;
  persistedData: Maybe<CheckpointMinMaxAvg>;
  processedData: Maybe<CheckpointMinMaxAvg>;
  stateSize: Maybe<CheckpointMinMaxAvg>;
};

/** Per-vertex rollup within a checkpoint detail, keyed by the job vertex. */
export type CheckpointTaskDetail = {
  __typename?: 'CheckpointTaskDetail';
  checkpointedSize: Maybe<Scalars['String']['output']>;
  endToEndDuration: Scalars['String']['output'];
  latestAckTimestamp: Scalars['String']['output'];
  numAcknowledgedSubtasks: Scalars['Int']['output'];
  numSubtasks: Scalars['Int']['output'];
  persistedData: Maybe<Scalars['String']['output']>;
  processedData: Maybe<Scalars['String']['output']>;
  stateSize: Scalars['String']['output'];
  status: Scalars['String']['output'];
  vertexId: Scalars['String']['output'];
};

/** Information about a registered Flink cluster connection. */
export type ClusterInfo = {
  __typename?: 'ClusterInfo';
  capabilities: Array<Scalars['String']['output']>;
  lastCheckTime: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  status: ClusterStatus;
  url: Scalars['String']['output'];
  version: Maybe<Scalars['String']['output']>;
};

/** A cluster overview snapshot capturing capacity and job counts at a point in time. */
export type ClusterOverviewSnapshot = {
  __typename?: 'ClusterOverviewSnapshot';
  /** When this snapshot was captured (RFC3339). */
  capturedAt: Scalars['String']['output'];
  /** Cluster name. */
  cluster: Scalars['String']['output'];
  /** Flink version string. */
  flinkVersion: Scalars['String']['output'];
  /** Number of cancelled jobs. */
  jobsCancelled: Scalars['Int']['output'];
  /** Number of failed jobs. */
  jobsFailed: Scalars['Int']['output'];
  /** Number of finished jobs. */
  jobsFinished: Scalars['Int']['output'];
  /** Number of running jobs. */
  jobsRunning: Scalars['Int']['output'];
  /** Available (free) task slots. */
  slotsAvailable: Scalars['Int']['output'];
  /** Total task slots. */
  slotsTotal: Scalars['Int']['output'];
  /** Number of task managers. */
  taskManagers: Scalars['Int']['output'];
};

/** Health status of a registered Flink cluster. */
export type ClusterStatus =
  | 'HEALTHY'
  | 'UNHEALTHY'
  | 'UNKNOWN';

export type ColumnInfo = {
  __typename?: 'ColumnInfo';
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type CompatibilityIssue = {
  __typename?: 'CompatibilityIssue';
  /** MAX_PARALLELISM | UNMAPPED_STATE | SERIALIZER | SCHEMA_EVOLUTION */
  category: Scalars['String']['output'];
  component: Scalars['String']['output'];
  message: Scalars['String']['output'];
  operatorKey: Scalars['String']['output'];
  severity: IssueSeverity;
};

export type CompatibilityReport = {
  __typename?: 'CompatibilityReport';
  canProceed: Scalars['Boolean']['output'];
  /** Set when the check was persisted. */
  checkId: Maybe<Scalars['ID']['output']>;
  /** ISO timestamp; null for a non-persisted preview. */
  checkedAt: Maybe<Scalars['String']['output']>;
  environment: Scalars['String']['output'];
  issues: Array<CompatibilityIssue>;
  pipeline: Scalars['String']['output'];
  verdict: CompatibilityVerdict;
};

/**
 * The result of a compatibility check. `messages` describes incompatibilities
 * when `isCompatible` is false; empty otherwise.
 */
export type CompatibilityResult = {
  __typename?: 'CompatibilityResult';
  isCompatible: Scalars['Boolean']['output'];
  messages: Array<Scalars['String']['output']>;
};

export type CompatibilityVerdict =
  | 'COMPATIBLE'
  | 'INCOMPATIBLE'
  | 'WARNING';

export type ConfigEntry = {
  __typename?: 'ConfigEntry';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** I/O throughput metrics for a connector */
export type ConnectorMetrics = {
  __typename?: 'ConnectorMetrics';
  /** Bytes read */
  bytesRead: Scalars['String']['output'];
  /** Bytes written */
  bytesWritten: Scalars['String']['output'];
  /** Records read (for sources) */
  recordsRead: Scalars['String']['output'];
  /** Records written (for sinks) */
  recordsWritten: Scalars['String']['output'];
};

export type CreateAlertRuleInput = {
  condition: AlertConditionInput;
  description: InputMaybe<Scalars['String']['input']>;
  enabled: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  owner: InputMaybe<Scalars['String']['input']>;
  severity: AlertSeverity;
};

export type DashboardConfig = {
  __typename?: 'DashboardConfig';
  clusters: Array<Scalars['String']['output']>;
  instruments: Array<Scalars['String']['output']>;
};

/** A column in a database table. */
export type DatabaseColumn = {
  __typename?: 'DatabaseColumn';
  comment: Scalars['String']['output'];
  dataType: Scalars['String']['output'];
  defaultValue: Scalars['String']['output'];
  isPrimaryKey: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  nullable: Scalars['Boolean']['output'];
};

/** A constraint on a database table. */
export type DatabaseConstraint = {
  __typename?: 'DatabaseConstraint';
  columns: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  refColumns: Array<Scalars['String']['output']>;
  refTable: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

/** An index on a database table. */
export type DatabaseIndex = {
  __typename?: 'DatabaseIndex';
  columns: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
  unique: Scalars['Boolean']['output'];
};

/** A recorded query execution in the history. */
export type DatabaseQueryHistoryEntry = {
  __typename?: 'DatabaseQueryHistoryEntry';
  error: Maybe<Scalars['String']['output']>;
  executedAt: Scalars['String']['output'];
  executionTimeMs: Scalars['Int']['output'];
  rowCount: Scalars['Int']['output'];
  sql: Scalars['String']['output'];
};

/** Result of executing a database query. */
export type DatabaseQueryResult = {
  __typename?: 'DatabaseQueryResult';
  columns: Array<DatabaseResultColumn>;
  executionTimeMs: Scalars['Int']['output'];
  rowCount: Scalars['Int']['output'];
  rows: Array<Maybe<Array<Maybe<Scalars['JSON']['output']>>>>;
  truncated: Scalars['Boolean']['output'];
};

/** A column in a query result set. */
export type DatabaseResultColumn = {
  __typename?: 'DatabaseResultColumn';
  dataType: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

/** A database schema (e.g., public, analytics). */
export type DatabaseSchema = {
  __typename?: 'DatabaseSchema';
  name: Scalars['String']['output'];
  tableCount: Scalars['Int']['output'];
};

/** Detailed information about a database table. */
export type DatabaseTableDetail = {
  __typename?: 'DatabaseTableDetail';
  columns: Array<DatabaseColumn>;
  constraints: Array<DatabaseConstraint>;
  indexes: Array<DatabaseIndex>;
  name: Scalars['String']['output'];
  schema: Scalars['String']['output'];
};

/** Summary of a database table within a schema. */
export type DatabaseTableSummary = {
  __typename?: 'DatabaseTableSummary';
  name: Scalars['String']['output'];
  rowCountEstimate: Scalars['Int']['output'];
  schema: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type DeleteResult = {
  __typename?: 'DeleteResult';
  success: Scalars['Boolean']['output'];
};

export type ExceptionEntry = {
  __typename?: 'ExceptionEntry';
  /**
   * Other failures Flink grouped with this root cause (subtasks that failed
   * simultaneously). Each carries its own fields and labels; empty for a single
   * failure.
   */
  concurrentExceptions: Maybe<Array<ExceptionEntry>>;
  endpoint: Maybe<Scalars['String']['output']>;
  exceptionName: Scalars['String']['output'];
  /**
   * FLIP-304 failure labels (Flink 1.19+), sorted by key. Empty on older clusters
   * or unclassified failures.
   */
  failureLabels: Maybe<Array<FailureLabel>>;
  stacktrace: Scalars['String']['output'];
  taskManagerId: Maybe<Scalars['String']['output']>;
  taskName: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['String']['output'];
};

/** Connection type for paginated exception history results. */
export type ExceptionHistoryConnection = {
  __typename?: 'ExceptionHistoryConnection';
  /** List of exception history edges. */
  edges: Array<ExceptionHistoryEdge>;
  /** Pagination metadata. */
  pageInfo: ExceptionHistoryPageInfo;
};

/** A single edge in the exception history connection. */
export type ExceptionHistoryEdge = {
  __typename?: 'ExceptionHistoryEdge';
  /** Opaque cursor for this edge. */
  cursor: Scalars['String']['output'];
  /** The exception record. */
  node: StoredException;
};

/** Filter criteria for historical exception queries. */
export type ExceptionHistoryFilter = {
  /** Return only exceptions with timestamp >= this timestamp. */
  after: InputMaybe<Scalars['String']['input']>;
  /** Return only exceptions with timestamp <= this timestamp. */
  before: InputMaybe<Scalars['String']['input']>;
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars['String']['input']>;
  /** Filter by exception name (case-insensitive substring match). */
  exceptionName: InputMaybe<Scalars['String']['input']>;
  /** Filter by job ID. */
  jobID: InputMaybe<Scalars['String']['input']>;
};

/** Page info for exception history pagination. */
export type ExceptionHistoryPageInfo = {
  __typename?: 'ExceptionHistoryPageInfo';
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars['String']['output']>;
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars['Boolean']['output'];
};

/**
 * A single FLIP-304 failure label: a machine-readable classification attached to
 * an exception by a pluggable failure enricher (e.g. `key: "type", value: "SYSTEM"`).
 */
export type FailureLabel = {
  __typename?: 'FailureLabel';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
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

/** Fields of a single column in a Fluss table schema. */
export type FlussSchemaField = {
  __typename?: 'FlussSchemaField';
  comment: Scalars['String']['output'];
  name: Scalars['String']['output'];
  nullable: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
};

/**
 * Full metadata for a single Fluss table — schema, bucket configuration,
 * connector properties, last-update timestamp.
 */
export type FlussTableMetadata = {
  __typename?: 'FlussTableMetadata';
  bucketCount: Scalars['Int']['output'];
  bucketKey: Array<Scalars['String']['output']>;
  comment: Scalars['String']['output'];
  database: Scalars['String']['output'];
  lastUpdatedMs: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  primaryKey: Array<Scalars['String']['output']>;
  properties: Scalars['JSON']['output'];
  schema: Array<FlussSchemaField>;
  tableType: Scalars['String']['output'];
};

/**
 * A Fluss table at the summary granularity returned by `flussTables`.
 * The `tableType` is either "PrimaryKey" (KV-style upsert) or "Log" (append-only).
 */
export type FlussTableSummary = {
  __typename?: 'FlussTableSummary';
  bucketCount: Scalars['Int']['output'];
  bucketKey: Array<Scalars['String']['output']>;
  database: Scalars['String']['output'];
  lastUpdatedMs: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  primaryKey: Array<Scalars['String']['output']>;
  tableType: Scalars['String']['output'];
};

/**
 * Health of a single TabletServer in the Fluss cluster. `leadership` is the
 * number of bucket leaderships the server currently holds.
 */
export type FlussTabletServerHealth = {
  __typename?: 'FlussTabletServerHealth';
  alive: Scalars['Boolean']['output'];
  leadership: Scalars['Int']['output'];
  server: Scalars['String']['output'];
};

/** High-availability status derived from the cluster config (observe-only). */
export type HaStatus = {
  __typename?: 'HAStatus';
  /** HA cluster id (high-availability.cluster-id), when set. */
  clusterId: Maybe<Scalars['String']['output']>;
  /** True when HA is configured (type is neither none nor empty). */
  enabled: Scalars['Boolean']['output'];
  /** HA type/mode: NONE, zookeeper, or kubernetes (raw value from config). */
  mode: Scalars['String']['output'];
  /** HA storage directory (high-availability.storageDir), when set. */
  storageDir: Maybe<Scalars['String']['output']>;
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

/**
 * The result of a live instrument connection test. `ok` is true when the
 * transient instrument initialized and its health check passed. `message`
 * carries the failure reason when `ok` is false. `latencyMs` is the round-trip
 * time of the successful check.
 */
export type InstrumentTestResult = {
  __typename?: 'InstrumentTestResult';
  latencyMs: Maybe<Scalars['Int']['output']>;
  message: Maybe<Scalars['String']['output']>;
  ok: Scalars['Boolean']['output'];
};

export type IssueSeverity =
  | 'ERROR'
  | 'WARNING';

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

export type JobConfig = {
  __typename?: 'JobConfig';
  /**
   * Execution mode (e.g. PIPELINED / BATCH). Nullable: Flink 2.0 removed
   * execution-mode from /jobs/:jid/config, so this is null on 2.0+ clusters.
   */
  executionMode: Maybe<Scalars['String']['output']>;
  jid: Scalars['String']['output'];
  jobParallelism: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  objectReuseMode: Scalars['Boolean']['output'];
  restartStrategy: Scalars['String']['output'];
  userConfig: Array<ConfigEntry>;
};

/** Detected source or sink connector for a job */
export type JobConnector = {
  __typename?: 'JobConnector';
  /** Detection confidence 0.0-1.0 */
  confidence: Scalars['Float']['output'];
  /** Connector technology: kafka, iceberg, paimon, jdbc, filesystem, unknown */
  connectorType: Scalars['String']['output'];
  /** How the connector was detected: manifest, vertex_name, plan_node */
  detectionMethod: Scalars['String']['output'];
  /** I/O metrics for this connector's vertex */
  metrics: Maybe<ConnectorMetrics>;
  /** Primary resource identifier (topic, table, path) */
  resource: Scalars['String']['output'];
  /** Role in the pipeline: source or sink */
  role: Scalars['String']['output'];
  /** Flink vertex ID */
  vertexId: Scalars['ID']['output'];
  /** Vertex or component name */
  vertexName: Scalars['String']['output'];
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
  jobConfig: Maybe<JobConfig>;
  /** Job-wide throughput rates derived from source/sink vertex metrics. */
  metrics: Maybe<JobMetrics>;
  name: Scalars['String']['output'];
  now: Scalars['String']['output'];
  plan: JobPlan;
  /** Per-job failover / restart summary (observe-only). Null when unavailable. */
  restartInfo: Maybe<RestartInfo>;
  /** Detected sources and sinks for this job */
  sourcesAndSinks: Array<JobConnector>;
  startTime: Scalars['String']['output'];
  state: Scalars['String']['output'];
  vertexDetails: Maybe<Array<VertexDetail>>;
  vertices: Array<JobVertex>;
  /**
   * Watermark lag in milliseconds (`now - min subtask watermark`).
   * Encoded as a string (Long) to safely represent very large lags.
   * Null when no valid watermarks are reported (e.g. batch jobs, or before
   * any source has emitted a watermark).
   */
  watermarkLag: Maybe<Scalars['String']['output']>;
  watermarks: Maybe<Array<VertexWatermarks>>;
};

/** Connection type for paginated job history results. */
export type JobHistoryConnection = {
  __typename?: 'JobHistoryConnection';
  /** List of job history edges. */
  edges: Array<JobHistoryEdge>;
  /** Pagination metadata. */
  pageInfo: JobHistoryPageInfo;
};

/** A single edge in the job history connection. */
export type JobHistoryEdge = {
  __typename?: 'JobHistoryEdge';
  /** Opaque cursor for this edge. */
  cursor: Scalars['String']['output'];
  /** The job record. */
  node: JobHistoryEntry;
};

/** A historical job record from PostgreSQL. */
export type JobHistoryEntry = {
  __typename?: 'JobHistoryEntry';
  capturedAt: Scalars['String']['output'];
  cluster: Scalars['String']['output'];
  durationMs: Scalars['String']['output'];
  endTime: Maybe<Scalars['String']['output']>;
  jid: Scalars['String']['output'];
  name: Scalars['String']['output'];
  startTime: Maybe<Scalars['String']['output']>;
  state: Scalars['String']['output'];
  tasksCanceled: Scalars['Int']['output'];
  tasksFailed: Scalars['Int']['output'];
  tasksFinished: Scalars['Int']['output'];
  tasksRunning: Scalars['Int']['output'];
  tasksTotal: Scalars['Int']['output'];
};

/** Filter criteria for historical job queries. */
export type JobHistoryFilter = {
  /** Return only jobs with start_time >= this timestamp. */
  after: InputMaybe<Scalars['String']['input']>;
  /** Return only jobs with start_time <= this timestamp. */
  before: InputMaybe<Scalars['String']['input']>;
  /** Filter by cluster name. */
  clusterID: InputMaybe<Scalars['String']['input']>;
  /** Filter by job name (case-insensitive substring match). */
  name: InputMaybe<Scalars['String']['input']>;
  /** Filter by job state (e.g. RUNNING, FAILED, FINISHED, CANCELED). */
  state: InputMaybe<Scalars['String']['input']>;
  /** Preset time range filter. Custom after/before takes precedence if both provided. */
  timeRange: InputMaybe<TimeRange>;
};

/** Sortable fields for job history results. */
export type JobHistoryOrderField =
  | 'DURATION'
  | 'END_TIME'
  | 'NAME'
  | 'START_TIME'
  | 'STATE';

/** Page info for cursor-based pagination. */
export type JobHistoryPageInfo = {
  __typename?: 'JobHistoryPageInfo';
  /** Cursor for fetching the next page. */
  endCursor: Maybe<Scalars['String']['output']>;
  /** Whether there are more pages after this one. */
  hasNextPage: Scalars['Boolean']['output'];
  /** Total number of items matching the filter (for UI pagination controls). */
  totalCount: Scalars['Int']['output'];
};

export type JobManagerDetail = {
  __typename?: 'JobManagerDetail';
  config: Array<JmConfigEntry>;
  environment: Maybe<JmEnvironment>;
  /** High-availability status derived from the cluster config. */
  haStatus: HaStatus;
  metrics: Array<MetricEntry>;
};

/** Job-level rate metrics, aggregated from source/sink vertices. */
export type JobMetrics = {
  __typename?: 'JobMetrics';
  /** Records-per-second emitted by source vertices (job-wide input throughput). */
  recordsInPerSecond: Scalars['Float']['output'];
  /** Records-per-second consumed by sink vertices (job-wide output throughput). */
  recordsOutPerSecond: Scalars['Float']['output'];
};

export type JobOverview = {
  __typename?: 'JobOverview';
  duration: Scalars['String']['output'];
  endTime: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Job type (`STREAMING`/`BATCH`). Added to /jobs/overview in Flink 2.3 (FLIP-487); null on older clusters. */
  jobType: Maybe<Scalars['String']['output']>;
  lastModification: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** Records-per-second emitted by source vertices (job-wide input throughput). Null when no vertex metrics are available yet. */
  recordsInPerSecond: Maybe<Scalars['Float']['output']>;
  /** Records-per-second consumed by sink vertices (job-wide output throughput). Null when no vertex metrics are available yet. */
  recordsOutPerSecond: Maybe<Scalars['Float']['output']>;
  /** Scheduler type (e.g. `Adaptive`/`Default`). Added to /jobs/overview in Flink 2.3 (FLIP-487); null on older clusters. */
  schedulerType: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  state: Scalars['String']['output'];
  tasks: TaskCounts;
  /** Watermark lag in milliseconds (`now - min subtask watermark`). Null for batch jobs or before any source has emitted a watermark. */
  watermarkLag: Maybe<Scalars['Int']['output']>;
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

/** A single Kafka record returned by a topic preview read. */
export type KafkaMessage = {
  __typename?: 'KafkaMessage';
  key: Maybe<Scalars['String']['output']>;
  offset: Scalars['Int']['output'];
  partition: Scalars['Int']['output'];
  /** Record timestamp in epoch milliseconds. */
  timestamp: Scalars['Int']['output'];
  value: Scalars['String']['output'];
};

/** Read order for a topic preview. */
export type KafkaMessageOrder =
  /** Most recent records first (the live end of the stream). */
  | 'NEWEST'
  /** Earliest retained records first (e.g. the deterministic seed rows). */
  | 'OLDEST';

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

/** Result of seeding sample data into a Kafka instrument. */
export type KafkaSeedResult = {
  __typename?: 'KafkaSeedResult';
  dryRun: Scalars['Boolean']['output'];
  recordsProduced: Scalars['Int']['output'];
  /** Topic names skipped for any reason (no sample rows, or already populated with skipNonEmpty). */
  skipped: Array<Scalars['String']['output']>;
  topics: Array<KafkaSeededTopic>;
};

/**
 * A topic touched during a Kafka seed operation. Both dry and real runs consult
 * the broker, so existed/existingRecords reflect actual broker state either way.
 */
export type KafkaSeededTopic = {
  __typename?: 'KafkaSeededTopic';
  /** Topic was created (real run) / would be created (dry run). */
  created: Scalars['Boolean']['output'];
  /** Template domain from the seed catalog (e.g. ecommerce, iot). */
  domain: Scalars['String']['output'];
  /** Per-topic failure; null when the topic seeded cleanly. Seeding is best-effort per topic. */
  error: Maybe<Scalars['String']['output']>;
  /** Whether the topic already existed in the broker when the seed ran. */
  existed: Scalars['Boolean']['output'];
  /** Records already in the topic (sum of partition end−start offsets); 0 when absent. */
  existingRecords: Scalars['Int']['output'];
  /** Records produced (real run) / that would be produced (dry run). */
  recordsProduced: Scalars['Int']['output'];
  /** Skipped because the topic already holds records and skipNonEmpty was set. */
  skipped: Scalars['Boolean']['output'];
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

export type KeyFieldInput = {
  name: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

/** A column in a materialized table's schema (Flink 2.3+, from DESCRIBE). */
export type MaterializedColumn = {
  __typename?: 'MaterializedColumn';
  name: Scalars['String']['output'];
  nullable: Scalars['Boolean']['output'];
  primaryKey: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
  /** Watermark expression when the column is a rowtime attribute, else null. */
  watermark: Maybe<Scalars['String']['output']>;
};

export type MaterializedTable = {
  __typename?: 'MaterializedTable';
  catalog: Scalars['String']['output'];
  /** Schema columns parsed from DESCRIBE MATERIALIZED TABLE (Flink 2.3+); empty on older clusters. */
  columns: Array<MaterializedColumn>;
  database: Scalars['String']['output'];
  definingQuery: Maybe<Scalars['String']['output']>;
  freshness: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  refreshMode: Maybe<Scalars['String']['output']>;
  refreshStatus: MaterializedTableRefreshStatus;
};

export type MaterializedTableRefreshStatus =
  | 'ACTIVATED'
  | 'INITIALIZING'
  | 'SUSPENDED';

/** A metric available in the catalog (discovered from stored data). */
export type MetricCatalogEntry = {
  __typename?: 'MetricCatalogEntry';
  metricID: Scalars['String']['output'];
  sourceID: Scalars['String']['output'];
  sourceType: Scalars['String']['output'];
};

/** A single metric data point in a time series. */
export type MetricDataPoint = {
  __typename?: 'MetricDataPoint';
  /** When this data point was captured (RFC3339). */
  capturedAt: Scalars['String']['output'];
  /** The metric value. */
  value: Scalars['Float']['output'];
};

export type MetricEntry = {
  __typename?: 'MetricEntry';
  id: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/**
 * A sampled metric value published at ~1s cadence by the server's
 * MetricSampler. `jobId` is null for cluster-wide aggregates.
 * Supported `metric` values for v1: `throughput`, `watermarkLag`.
 */
export type MetricEvent = {
  __typename?: 'MetricEvent';
  clusterID: Scalars['String']['output'];
  jobId: Maybe<Scalars['ID']['output']>;
  metric: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

/** Filter criteria for metric time-series queries. */
export type MetricHistoryFilter = {
  /** Return only data points captured after this timestamp (RFC3339). */
  after: InputMaybe<Scalars['String']['input']>;
  /** Return only data points captured before this timestamp (RFC3339). */
  before: InputMaybe<Scalars['String']['input']>;
  /** Filter by cluster name (required). */
  clusterID: Scalars['String']['input'];
  /** Filter by metric ID (e.g. Status.JVM.CPU.Load). */
  metricID: InputMaybe<Scalars['String']['input']>;
  /** Filter by source ID (e.g. TM ID, vertex ID). */
  sourceID: InputMaybe<Scalars['String']['input']>;
  /** Filter by source type: job_manager, task_manager, vertex. */
  sourceType: InputMaybe<Scalars['String']['input']>;
};

/** Request for a single metric time series. */
export type MetricSeriesRequest = {
  metricID: Scalars['String']['input'];
  sourceID: Scalars['String']['input'];
  sourceType: Scalars['String']['input'];
};

/** A time series for one metric. */
export type MetricTimeSeries = {
  __typename?: 'MetricTimeSeries';
  metricID: Scalars['String']['output'];
  points: Array<MetricDataPoint>;
  sourceID: Scalars['String']['output'];
  sourceType: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Acknowledge a FIRING instance; transitions state to ACKNOWLEDGED. */
  acknowledgeAlert: AlertInstance;
  /** Cancel an application and all its jobs (Flink 2.3+). */
  cancelApplication: CancelApplicationResult;
  /** Cancel a running job */
  cancelJob: CancelJobResult;
  /** Compare a proposed manifest against the stored latest version. Persists the check unless persist is false. */
  checkDeploymentCompatibility: CompatibilityReport;
  /**
   * Check whether a candidate schema is compatible with the latest version of a
   * subject. This is read-only on the registry — the schema is not registered.
   */
  checkSchemaCompatibility: CompatibilityResult;
  /** Close a SQL Gateway session */
  closeSQLSession: SqlCloseResult;
  createAlertRule: AlertRule;
  /** Create a new SQL Gateway session */
  createSQLSession: SqlSessionResult;
  deleteAlertRule: DeleteResult;
  /** Delete an uploaded JAR */
  deleteJar: DeleteResult;
  /**
   * Execute a read-only SQL query against a database instrument.
   * DDL statements are rejected. Results are capped at the configured row limit.
   */
  executeDatabaseQuery: DatabaseQueryResult;
  /** Submit EXPLAIN for a SQL statement and return the plan text */
  explainStatement: SqlExplainResult;
  /** Fetch results from a SQL statement execution */
  fetchSQLResults: SqlFetchResult;
  /** Trigger a manual refresh of a materialized table */
  refreshMaterializedTable: MaterializedTable;
  /** Rescale a running job to a new parallelism */
  rescaleJob: RescaleResult;
  /** Manually resolve an instance (works from any state). */
  resolveAlert: AlertInstance;
  /** Resume a materialized table's refresh */
  resumeMaterializedTable: MaterializedTable;
  /**
   * Run an uploaded JAR to submit a job.
   *
   * Program arguments may be given as `programArgsList` (an array — the form Flink
   * 2.0+ expects) or the legacy `programArgs` string (deprecated on 2.0). When
   * `programArgsList` is non-empty it takes precedence and `programArgs` is ignored.
   */
  runJar: JarRunResult;
  /** Run a simulation scenario */
  runSimulation: SimulationRun;
  /**
   * Seed sample data into a Kafka instrument's topics. Governed by the
   * environment seeding policy: enabled by default in development, opt-in in
   * staging, and never permitted in production. By default only this project's
   * topics are seeded (catalog subjects whose topic already exists in the
   * broker — `cluster up` materializes every declared topic, so project scope
   * and declared scope coincide); allTopics: true widens to the entire sample
   * catalog, creating each missing topic. domains restricts the run to the given
   * catalog domains (e.g. ["ecommerce"]). skipNonEmpty defaults to TRUE when
   * omitted: topics that already hold records are reported as skipped instead of
   * appended to — pass skipNonEmpty: false to force append. dryRun consults the
   * broker and reports exactly what a real run would do, without producing.
   */
  seedKafkaTopics: KafkaSeedResult;
  /** Mark an instance as SILENCED (suppresses repeat firings until resolved). */
  silenceAlert: AlertInstance;
  /** Stop a running job with a savepoint (graceful shutdown) */
  stopJobWithSavepoint: SavepointTriggerResult;
  /** Stop a running simulation */
  stopSimulation: SimulationRun;
  /** Submit a SQL statement to an existing session */
  submitStatement: SqlStatementResult;
  /** Suspend a materialized table's refresh */
  suspendMaterializedTable: MaterializedTable;
  /**
   * Test a candidate instrument connection without persisting or registering it.
   * Constructs a transient instrument of the given type, runs
   * Init → HealthCheck → Shutdown under a bounded timeout, and reports the
   * outcome. The `config` is the same free-form object used in YAML config.
   */
  testInstrumentConnection: InstrumentTestResult;
  /**
   * Start an async-profiler run on the job manager (FLIP-375). Requires the
   * ASYNC_PROFILER capability (Flink >= 1.19 with rest.profiling.enabled).
   */
  triggerJobManagerProfiler: ProfilerInstance;
  /** Trigger a savepoint for a running job */
  triggerSavepoint: SavepointTriggerResult;
  /**
   * Start an async-profiler run on a task manager (FLIP-375). Requires the
   * ASYNC_PROFILER capability (Flink >= 1.19 with rest.profiling.enabled).
   */
  triggerTaskManagerProfiler: ProfilerInstance;
  updateAlertRule: AlertRule;
};


export type MutationAcknowledgeAlertArgs = {
  id: Scalars['ID']['input'];
  note: InputMaybe<Scalars['String']['input']>;
};


export type MutationCancelApplicationArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationCancelJobArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationCheckDeploymentCompatibilityArgs = {
  environment: InputMaybe<Scalars['String']['input']>;
  newManifest: StateManifestInput;
  persist: InputMaybe<Scalars['Boolean']['input']>;
  pipeline: Scalars['String']['input'];
};


export type MutationCheckSchemaCompatibilityArgs = {
  instrument: Scalars['String']['input'];
  schema: Scalars['String']['input'];
  schemaType: Scalars['String']['input'];
  subject: Scalars['String']['input'];
};


export type MutationCloseSqlSessionArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  sessionHandle: Scalars['String']['input'];
};


export type MutationCreateAlertRuleArgs = {
  input: CreateAlertRuleInput;
};


export type MutationCreateSqlSessionArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type MutationDeleteAlertRuleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteJarArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationExecuteDatabaseQueryArgs = {
  instrument: Scalars['String']['input'];
  sql: Scalars['String']['input'];
};


export type MutationExplainStatementArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  sessionHandle: Scalars['String']['input'];
  statement: Scalars['String']['input'];
};


export type MutationFetchSqlResultsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  operationHandle: Scalars['String']['input'];
  sessionHandle: Scalars['String']['input'];
  token: InputMaybe<Scalars['String']['input']>;
};


export type MutationRefreshMaterializedTableArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationRescaleJobArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  newParallelism: Scalars['Int']['input'];
};


export type MutationResolveAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationResumeMaterializedTableArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationRunJarArgs = {
  allowNonRestoredState: InputMaybe<Scalars['Boolean']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
  entryClass: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  parallelism: InputMaybe<Scalars['Int']['input']>;
  programArgs: InputMaybe<Scalars['String']['input']>;
  programArgsList: InputMaybe<Array<Scalars['String']['input']>>;
  savepointPath: InputMaybe<Scalars['String']['input']>;
};


export type MutationRunSimulationArgs = {
  input: SimulationInput;
};


export type MutationSeedKafkaTopicsArgs = {
  allTopics: InputMaybe<Scalars['Boolean']['input']>;
  domains: InputMaybe<Array<Scalars['String']['input']>>;
  dryRun: InputMaybe<Scalars['Boolean']['input']>;
  instrument: Scalars['String']['input'];
  skipNonEmpty: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationSilenceAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationStopJobWithSavepointArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  targetDirectory: InputMaybe<Scalars['String']['input']>;
};


export type MutationStopSimulationArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationSubmitStatementArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  sessionHandle: Scalars['String']['input'];
  statement: Scalars['String']['input'];
};


export type MutationSuspendMaterializedTableArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationTestInstrumentConnectionArgs = {
  config: Scalars['JSON']['input'];
  name: Scalars['String']['input'];
  type: Scalars['String']['input'];
};


export type MutationTriggerJobManagerProfilerArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  duration: Scalars['Int']['input'];
  mode: ProfilerMode;
};


export type MutationTriggerSavepointArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  targetDirectory: InputMaybe<Scalars['String']['input']>;
};


export type MutationTriggerTaskManagerProfilerArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  duration: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  mode: ProfilerMode;
};


export type MutationUpdateAlertRuleArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAlertRuleInput;
};

export type OperatorStateInput = {
  changelogMode: Scalars['String']['input'];
  component: Scalars['String']['input'];
  keyFields: Array<KeyFieldInput>;
  logicalKey: Scalars['String']['input'];
  maxParallelism: InputMaybe<Scalars['Int']['input']>;
  nodeId: Scalars['String']['input'];
  operatorHash: Scalars['String']['input'];
  stateRole: Scalars['String']['input'];
  ttl: InputMaybe<Scalars['String']['input']>;
};

/** Sorting configuration for query results. */
export type OrderByInput = {
  /** Sort direction (ASC or DESC). */
  direction: OrderDirection;
  /** The field to sort by. */
  field: JobHistoryOrderField;
};

/** Sort direction. */
export type OrderDirection =
  | 'ASC'
  | 'DESC';

/** Cursor-based pagination input. */
export type PaginationInput = {
  /** Opaque cursor for the next page. */
  after: InputMaybe<Scalars['String']['input']>;
  /** Maximum number of items to return. */
  first: InputMaybe<Scalars['Int']['input']>;
};

export type PipelineManifestVersion = {
  __typename?: 'PipelineManifestVersion';
  createdAt: Scalars['String']['output'];
  environment: Scalars['String']['output'];
  flinkVersion: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** The full canonical State Manifest JSON (sorted keys) for version diffing. */
  manifestJson: Scalars['String']['output'];
  pipeline: Scalars['String']['output'];
  source: Scalars['String']['output'];
  stateFingerprint: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

/**
 * A per-pipeline rollup for the State Registry index and the deployment kanban's
 * "Blocked" join. One row per (pipeline, environment); fetched in a single query
 * to avoid an N+1 over the per-pipeline report endpoints.
 */
export type PipelineStateSummary = {
  __typename?: 'PipelineStateSummary';
  environment: Scalars['String']['output'];
  flinkVersion: Maybe<Scalars['String']['output']>;
  lastCheckedAt: Maybe<Scalars['String']['output']>;
  /** Number of issues in the most recent check; null when none has run. */
  lastIssueCount: Maybe<Scalars['Int']['output']>;
  /** Verdict of the most recent compatibility check; null when none has run. */
  lastVerdict: Maybe<CompatibilityVerdict>;
  latestVersion: Scalars['Int']['output'];
  pipeline: Scalars['String']['output'];
  /** Count of SUCCESS restore outcomes (restoreTotal - this = failures). */
  restoreSuccess: Scalars['Int']['output'];
  /** Count of non-PENDING restore outcomes observed for this pipeline. */
  restoreTotal: Scalars['Int']['output'];
  stateFingerprint: Scalars['String']['output'];
  /** ISO timestamp of the latest manifest version. */
  updatedAt: Scalars['String']['output'];
  versionCount: Scalars['Int']['output'];
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

/** Result of a single pre-flight check for simulation readiness. */
export type PreflightCheck = {
  __typename?: 'PreflightCheck';
  detail: Maybe<Scalars['String']['output']>;
  fix: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  required: Scalars['Boolean']['output'];
  status: Scalars['String']['output'];
};

/**
 * A single async-profiler run on a TaskManager or the JobManager (FLIP-375,
 * Flink 1.19+). This is Flink's built-in JVM profiler and is deliberately
 * distinct from the operator flame graph: it profiles the whole JVM — CPU,
 * allocation pressure, lock contention, or wall-clock — rather than one
 * operator's on/off-CPU stacks.
 */
export type ProfilerInstance = {
  __typename?: 'ProfilerInstance';
  /** Console-proxied URL to open the flame graph; set when status is FINISHED. */
  downloadUrl: Maybe<Scalars['String']['output']>;
  /** Requested profiling window, in seconds. */
  duration: Scalars['Int']['output'];
  /** Stable id for the run — the output file name, assigned at trigger time. */
  id: Scalars['ID']['output'];
  /** Failure reason; set when status is FAILED. */
  message: Maybe<Scalars['String']['output']>;
  mode: ProfilerMode;
  /** Flame-graph output file name; set when status is FINISHED. */
  outputFile: Maybe<Scalars['String']['output']>;
  status: ProfilerStatus;
};

/** Async-profiler event mode (FLIP-375). Mirrors Flink's ProfilingMode. */
export type ProfilerMode =
  | 'ALLOC'
  | 'CPU'
  | 'ITIMER'
  | 'LOCK'
  | 'WALL';

/** Lifecycle status of an async-profiler run. */
export type ProfilerStatus =
  | 'FAILED'
  | 'FINISHED'
  | 'RUNNING';

export type Query = {
  __typename?: 'Query';
  /** All currently FIRING or ACKNOWLEDGED instances. */
  activeAlerts: Array<AlertInstance>;
  /** Paginated historical alert instances. */
  alertHistory: AlertHistoryPage;
  /** A single rule by ID. */
  alertRule: Maybe<AlertRule>;
  /** All configured alert rules. */
  alertRules: Array<AlertRule>;
  /** Get a single application by id. Null when not found (Flink 2.3+). */
  application: Maybe<Application>;
  /** List applications in the cluster. Empty on clusters without application mode (Flink 2.3+). */
  applications: Array<Application>;
  blueGreenDeployment: Maybe<BlueGreenDeployment>;
  blueGreenDeploymentConfigDiff: BlueGreenConfigDiff;
  blueGreenDeployments: Array<BlueGreenDeployment>;
  /** List columns for a table */
  catalogColumns: Array<ColumnInfo>;
  /** List databases within a catalog */
  catalogDatabases: Array<CatalogDatabase>;
  /** Get the CREATE TABLE DDL for a table */
  catalogTableDDL: Scalars['String']['output'];
  /** List tables within a catalog database */
  catalogTables: Array<CatalogTable>;
  /** List all registered Flink catalogs */
  catalogs: Array<CatalogInfo>;
  /** Get full checkpoint detail including per-task rollups */
  checkpointDetail: CheckpointDetail;
  /** Returns paginated historical checkpoints with optional filtering. */
  checkpointHistory: CheckpointHistoryConnection;
  /** Get per-subtask checkpoint stats for one vertex of a checkpoint */
  checkpointSubtasks: CheckpointSubtaskStats;
  /** Returns historical cluster overview snapshots for capacity trend analysis. */
  clusterOverviewHistory: Array<ClusterOverviewSnapshot>;
  clusters: Array<ClusterInfo>;
  /** Get dashboard configuration (available clusters and instruments) */
  dashboardConfig: DashboardConfig;
  /** Get query execution history for a database instrument. */
  databaseQueryHistory: Array<DatabaseQueryHistoryEntry>;
  /** List schemas for a database instrument. */
  databaseSchemas: Array<DatabaseSchema>;
  /** Get detailed information about a specific database table. */
  databaseTable: DatabaseTableDetail;
  /** List tables in a schema for a database instrument. */
  databaseTables: Array<DatabaseTableSummary>;
  /** Returns paginated historical exceptions with optional filtering. */
  exceptionHistory: ExceptionHistoryConnection;
  /** Get flamegraph for a vertex */
  flamegraph: Flamegraph;
  /** Get Flink cluster configuration */
  flinkConfig: FlinkConfig;
  /** List every database registered in the Fluss cluster. */
  flussDatabases: Array<Scalars['String']['output']>;
  /** Get the full metadata for a single Fluss table. */
  flussTable: FlussTableMetadata;
  /** List the tables in a Fluss database with summary metadata. */
  flussTables: Array<FlussTableSummary>;
  /**
   * List the TabletServers in the Fluss cluster with their alive status and
   * leadership counts.
   */
  flussTabletServers: Array<FlussTabletServerHealth>;
  health: Scalars['Boolean']['output'];
  /** List all registered instruments with their health status and capabilities. */
  instruments: Array<InstrumentInfo>;
  /** List all uploaded JARs */
  jars: Array<JarFile>;
  /** Get detailed job information including vertices, checkpoints, exceptions */
  job: JobDetail;
  /** Returns paginated historical jobs with optional filtering and sorting. */
  jobHistory: JobHistoryConnection;
  /** Get job manager config, environment, and metrics */
  jobManager: JobManagerDetail;
  /**
   * List async-profiler runs for the job manager (FLIP-375). Empty when
   * profiling is unsupported or disabled on the cluster.
   * `ProfilerInstance` is defined in taskmanagers.graphqls.
   */
  jobManagerProfilerInstances: Array<ProfilerInstance>;
  /** Get job manager process stderr (tail-truncated to last 1 MB) */
  jobManagerStderr: Scalars['String']['output'];
  /** Get job manager process stdout (tail-truncated to last 1 MB) */
  jobManagerStdout: Scalars['String']['output'];
  /** Get job manager thread dump (live snapshot; empty when unavailable) */
  jobManagerThreadDump: Array<ThreadDumpEntry>;
  /** List all jobs in a cluster */
  jobs: Array<JobOverview>;
  /** Get detailed information about a specific consumer group. */
  kafkaConsumerGroup: KafkaConsumerGroupDetail;
  /** List consumer groups for a Kafka instrument. */
  kafkaConsumerGroups: Array<KafkaConsumerGroup>;
  /** Get detailed information about a specific Kafka topic. */
  kafkaTopic: KafkaTopicDetail;
  /**
   * Preview records from a topic using a throwaway consumer (no consumer group
   * is left behind). limit defaults to 20, capped at 200. order defaults to
   * NEWEST (live tail); OLDEST reads from the beginning, where the deterministic
   * seed rows live.
   */
  kafkaTopicMessages: Array<KafkaMessage>;
  /** List topics for a Kafka instrument. */
  kafkaTopics: Array<KafkaTopic>;
  /** The most recent persisted compatibility report for a pipeline, if any. */
  latestCompatibilityReport: Maybe<CompatibilityReport>;
  /** Get a single materialized table by name and catalog */
  materializedTable: Maybe<MaterializedTable>;
  /** List materialized tables, optionally filtered by catalog */
  materializedTables: Array<MaterializedTable>;
  /** Returns available metrics from stored data for a cluster. */
  metricCatalog: Array<MetricCatalogEntry>;
  /** Returns time-series metric data points matching the filter. */
  metricHistory: Array<MetricDataPoint>;
  /** Returns multiple metric time series in a single batch query. */
  metricSeries: Array<MetricTimeSeries>;
  /** Stored State Manifest versions for a pipeline (newest first). */
  pipelineManifestVersions: Array<PipelineManifestVersion>;
  /** Per-pipeline state rollups across the registry (all environments when environment is null). */
  pipelineStateSummaries: Array<PipelineStateSummary>;
  /** Get metadata (type, TTL, encoding, memory usage) for a single key. */
  redisKeyInfo: RedisKeyInfo;
  /**
   * Get the type-aware value of a single key. Strings are truncated at 10KB;
   * collections are limited to 100 entries.
   */
  redisKeyValue: RedisKeyValue;
  /** Get the parsed INFO memory section. */
  redisMemoryStats: RedisMemoryStats;
  /**
   * Scan keys for a Redis instrument. Use cursor "0" to start; pass the returned
   * cursor to fetch the next batch. `hasMore` is false when iteration is done.
   */
  redisScan: RedisScanResult;
  /** Get high-level Redis server stats (version, uptime, memory, keyspace). */
  redisServerInfo: RedisServerInfo;
  /** Get a single rescale event by UUID (Flink 2.3+, FLIP-495). */
  rescaleDetail: RescaleEvent;
  /** List AdaptiveScheduler rescale events for a job, newest first (Flink 2.3+, FLIP-495). */
  rescaleHistory: Array<RescaleEvent>;
  /** Aggregate rescale statistics for a job (Flink 2.3+, FLIP-495). */
  rescaleSummary: RescaleSummary;
  /** Observed restore outcomes for a pipeline (newest first). */
  restoreEvents: Array<RestoreEvent>;
  /** Get a single savepoint operation by ID. */
  savepoint: Savepoint;
  /** List savepoints for a job, ordered by triggeredAt descending. */
  savepoints: Array<Savepoint>;
  /** Get the full schema for a specific subject and version. */
  schemaDetail: SchemaDetail;
  /** Get the registry's global default compatibility level. */
  schemaRegistryConfig: SchemaRegistryConfig;
  /** List all subjects in the Schema Registry, with their latest version metadata. */
  schemaSubjects: Array<SchemaSubject>;
  /** List the version numbers registered for a subject. */
  schemaVersions: Array<Scalars['Int']['output']>;
  /** Run pre-flight checks verifying minikube infrastructure is ready for simulations. */
  simulationPreflight: Array<PreflightCheck>;
  /** List available simulation presets */
  simulationPresets: Array<SimulationPreset>;
  /** Get a specific simulation run by ID */
  simulationRun: Maybe<SimulationRun>;
  /** List all simulation runs (most recent first) */
  simulationRuns: Array<SimulationRun>;
  /** Returns the status of the PostgreSQL storage backend. */
  storageStatus: StorageStatus;
  /** Get subtask times for a vertex */
  subtaskTimes: SubtaskTimes;
  /** List all loaded tap pipeline manifests */
  tapManifests: Array<TapManifest>;
  /** Get detailed task manager info with metrics */
  taskManager: TaskManagerDetail;
  /** Get task manager logs list */
  taskManagerLogs: Array<TmLogEntry>;
  /**
   * List async-profiler runs for a task manager (FLIP-375). Empty when
   * profiling is unsupported or disabled on the cluster.
   */
  taskManagerProfilerInstances: Array<ProfilerInstance>;
  /** Get task manager process stderr (tail-truncated to last 1 MB) */
  taskManagerStderr: Scalars['String']['output'];
  /** Get task manager process stdout (tail-truncated to last 1 MB) */
  taskManagerStdout: Scalars['String']['output'];
  /** Get task manager thread dump */
  taskManagerThreadDump: Array<ThreadDumpEntry>;
  /** List all task managers in a cluster */
  taskManagers: Array<TaskManagerOverview>;
  /** Get vertex detail with subtask info */
  vertexDetail: VertexDetail;
};


export type QueryAlertHistoryArgs = {
  filter: InputMaybe<AlertHistoryFilterInput>;
};


export type QueryAlertRuleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAlertRulesArgs = {
  enabledOnly: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryApplicationArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryApplicationsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryBlueGreenDeploymentArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  namespace: InputMaybe<Scalars['String']['input']>;
};


export type QueryBlueGreenDeploymentConfigDiffArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  namespace: InputMaybe<Scalars['String']['input']>;
};


export type QueryBlueGreenDeploymentsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  namespace: InputMaybe<Scalars['String']['input']>;
};


export type QueryCatalogColumnsArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  database: Scalars['String']['input'];
  table: Scalars['String']['input'];
};


export type QueryCatalogDatabasesArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryCatalogTableDdlArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  database: Scalars['String']['input'];
  table: Scalars['String']['input'];
};


export type QueryCatalogTablesArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  database: Scalars['String']['input'];
};


export type QueryCatalogsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryCheckpointDetailArgs = {
  checkpointId: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
};


export type QueryCheckpointHistoryArgs = {
  filter: InputMaybe<CheckpointHistoryFilter>;
  pagination: InputMaybe<PaginationInput>;
};


export type QueryCheckpointSubtasksArgs = {
  checkpointId: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  vertexId: Scalars['ID']['input'];
};


export type QueryClusterOverviewHistoryArgs = {
  after: InputMaybe<Scalars['String']['input']>;
  before: InputMaybe<Scalars['String']['input']>;
  clusterID: Scalars['String']['input'];
};


export type QueryDatabaseQueryHistoryArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryDatabaseSchemasArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryDatabaseTableArgs = {
  instrument: Scalars['String']['input'];
  schema: Scalars['String']['input'];
  table: Scalars['String']['input'];
};


export type QueryDatabaseTablesArgs = {
  instrument: Scalars['String']['input'];
  schema: Scalars['String']['input'];
};


export type QueryExceptionHistoryArgs = {
  filter: InputMaybe<ExceptionHistoryFilter>;
  pagination: InputMaybe<PaginationInput>;
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


export type QueryFlussDatabasesArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryFlussTableArgs = {
  database: Scalars['String']['input'];
  instrument: Scalars['String']['input'];
  table: Scalars['String']['input'];
};


export type QueryFlussTablesArgs = {
  database: Scalars['String']['input'];
  instrument: Scalars['String']['input'];
};


export type QueryFlussTabletServersArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryJarsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryJobHistoryArgs = {
  filter: InputMaybe<JobHistoryFilter>;
  orderBy: InputMaybe<OrderByInput>;
  pagination: InputMaybe<PaginationInput>;
};


export type QueryJobManagerArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobManagerProfilerInstancesArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobManagerStderrArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobManagerStdoutArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryJobManagerThreadDumpArgs = {
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


export type QueryKafkaTopicMessagesArgs = {
  instrument: Scalars['String']['input'];
  limit: InputMaybe<Scalars['Int']['input']>;
  order: InputMaybe<KafkaMessageOrder>;
  topic: Scalars['String']['input'];
};


export type QueryKafkaTopicsArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryLatestCompatibilityReportArgs = {
  environment: InputMaybe<Scalars['String']['input']>;
  pipeline: Scalars['String']['input'];
};


export type QueryMaterializedTableArgs = {
  catalog: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type QueryMaterializedTablesArgs = {
  catalog: InputMaybe<Scalars['String']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type QueryMetricCatalogArgs = {
  clusterID: Scalars['String']['input'];
};


export type QueryMetricHistoryArgs = {
  filter: MetricHistoryFilter;
};


export type QueryMetricSeriesArgs = {
  after: Scalars['String']['input'];
  before: Scalars['String']['input'];
  clusterID: Scalars['String']['input'];
  maxPoints: InputMaybe<Scalars['Int']['input']>;
  series: Array<MetricSeriesRequest>;
};


export type QueryPipelineManifestVersionsArgs = {
  environment: InputMaybe<Scalars['String']['input']>;
  pipeline: Scalars['String']['input'];
};


export type QueryPipelineStateSummariesArgs = {
  environment: InputMaybe<Scalars['String']['input']>;
};


export type QueryRedisKeyInfoArgs = {
  instrument: Scalars['String']['input'];
  key: Scalars['String']['input'];
};


export type QueryRedisKeyValueArgs = {
  instrument: Scalars['String']['input'];
  key: Scalars['String']['input'];
};


export type QueryRedisMemoryStatsArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryRedisScanArgs = {
  count: InputMaybe<Scalars['Int']['input']>;
  cursor: InputMaybe<Scalars['String']['input']>;
  instrument: Scalars['String']['input'];
  pattern: InputMaybe<Scalars['String']['input']>;
};


export type QueryRedisServerInfoArgs = {
  instrument: Scalars['String']['input'];
};


export type QueryRescaleDetailArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  rescaleUuid: Scalars['String']['input'];
};


export type QueryRescaleHistoryArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
};


export type QueryRescaleSummaryArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
};


export type QueryRestoreEventsArgs = {
  environment: InputMaybe<Scalars['String']['input']>;
  pipeline: Scalars['String']['input'];
};


export type QuerySavepointArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
  savepointId: Scalars['String']['input'];
};


export type QuerySavepointsArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  jobId: Scalars['ID']['input'];
};


export type QuerySchemaDetailArgs = {
  instrument: Scalars['String']['input'];
  subject: Scalars['String']['input'];
  version: Scalars['Int']['input'];
};


export type QuerySchemaRegistryConfigArgs = {
  instrument: Scalars['String']['input'];
};


export type QuerySchemaSubjectsArgs = {
  instrument: Scalars['String']['input'];
};


export type QuerySchemaVersionsArgs = {
  instrument: Scalars['String']['input'];
  subject: Scalars['String']['input'];
};


export type QuerySimulationRunArgs = {
  id: Scalars['ID']['input'];
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


export type QueryTaskManagerProfilerInstancesArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryTaskManagerStderrArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryTaskManagerStdoutArgs = {
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

/** A single field/value pair from a Redis HASH. */
export type RedisHashEntry = {
  __typename?: 'RedisHashEntry';
  field: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** Metadata about a single Redis key. */
export type RedisKeyInfo = {
  __typename?: 'RedisKeyInfo';
  encoding: Scalars['String']['output'];
  key: Scalars['String']['output'];
  memoryUsage: Scalars['Int']['output'];
  ttl: Scalars['Int']['output'];
  type: Scalars['String']['output'];
};

/**
 * The type-aware value of a Redis key. Only the field corresponding to `type` is
 * populated; the others are null.
 */
export type RedisKeyValue = {
  __typename?: 'RedisKeyValue';
  hashValue: Maybe<Array<RedisHashEntry>>;
  key: Scalars['String']['output'];
  listValue: Maybe<Array<Scalars['String']['output']>>;
  setValue: Maybe<Array<Scalars['String']['output']>>;
  stringValue: Maybe<Scalars['String']['output']>;
  totalSize: Scalars['Int']['output'];
  truncated: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
  zsetValue: Maybe<Array<RedisZSetEntry>>;
};

/** Memory breakdown parsed from INFO memory. */
export type RedisMemoryStats = {
  __typename?: 'RedisMemoryStats';
  allocator: Scalars['String']['output'];
  datasetSize: Scalars['Int']['output'];
  fragmentationRatio: Scalars['Float']['output'];
  overhead: Scalars['Int']['output'];
  peakMemory: Scalars['Int']['output'];
  rss: Scalars['Int']['output'];
  usedMemory: Scalars['Int']['output'];
};

/**
 * Result of a Redis SCAN operation: a batch of keys plus the cursor for the next
 * page (or "0" when iteration is complete).
 */
export type RedisScanResult = {
  __typename?: 'RedisScanResult';
  cursor: Scalars['String']['output'];
  hasMore: Scalars['Boolean']['output'];
  keys: Array<Scalars['String']['output']>;
};

/** High-level Redis server statistics parsed from INFO. */
export type RedisServerInfo = {
  __typename?: 'RedisServerInfo';
  connectedClients: Scalars['Int']['output'];
  keyspaceHits: Scalars['Int']['output'];
  keyspaceMisses: Scalars['Int']['output'];
  totalKeys: Scalars['Int']['output'];
  uptime: Scalars['Int']['output'];
  usedMemory: Scalars['Int']['output'];
  version: Scalars['String']['output'];
};

/** A single member/score pair from a Redis ZSET. */
export type RedisZSetEntry = {
  __typename?: 'RedisZSetEntry';
  member: Scalars['String']['output'];
  score: Scalars['Float']['output'];
};

/** A single AdaptiveScheduler rescale event (Flink 2.3+, FLIP-495). */
export type RescaleEvent = {
  __typename?: 'RescaleEvent';
  /** Wall-clock duration of the rescale in ms. Null until finished. */
  durationMs: Maybe<Scalars['String']['output']>;
  /** Failure reason. Null unless `status: FAILED`. */
  error: Maybe<Scalars['String']['output']>;
  /** Job parallelism after the rescale. Null when unknown. */
  parallelismAfter: Maybe<Scalars['Int']['output']>;
  /** Job parallelism before the rescale. Null when unknown. */
  parallelismBefore: Maybe<Scalars['Int']['output']>;
  status: RescaleStatus;
  /** Epoch-millis timestamp at which the rescale was triggered. */
  triggeredAt: Scalars['String']['output'];
  /** Rescale event identifier (UUID). */
  uuid: Scalars['String']['output'];
};

export type RescaleResult = {
  __typename?: 'RescaleResult';
  requestId: Scalars['String']['output'];
};

/** Lifecycle state of an adaptive-scheduler rescale event (Flink 2.3+, FLIP-495). */
export type RescaleStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_PROGRESS'
  | 'PENDING';

/** Aggregate rescale statistics for a job (Flink 2.3+, FLIP-495). */
export type RescaleSummary = {
  __typename?: 'RescaleSummary';
  /** Epoch-millis timestamp of the most recent rescale. Null when none. */
  lastRescaleAt: Maybe<Scalars['String']['output']>;
  totalRescales: Scalars['Int']['output'];
};

/**
 * Per-job failover / restart summary, sourced from job metrics
 * (numRestarts / fullRestarts / uptime / downtime) and job config
 * (restart-strategy). All fields are nullable — an absent metric means
 * "unknown", not zero. uptimeMs / downtimeMs are encoded as Long-safe
 * strings (ms can exceed a 32-bit Int for long-running jobs).
 */
export type RestartInfo = {
  __typename?: 'RestartInfo';
  downtimeMs: Maybe<Scalars['String']['output']>;
  fullRestarts: Maybe<Scalars['Int']['output']>;
  numRestarts: Maybe<Scalars['Int']['output']>;
  restartStrategy: Maybe<Scalars['String']['output']>;
  uptimeMs: Maybe<Scalars['String']['output']>;
};

export type RestoreEvent = {
  __typename?: 'RestoreEvent';
  blueGreenName: Maybe<Scalars['String']['output']>;
  cluster: Scalars['String']['output'];
  environment: Scalars['String']['output'];
  errorCategory: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  jid: Maybe<Scalars['String']['output']>;
  observedAt: Scalars['String']['output'];
  /** PENDING | SUCCESS | FAILED | UNKNOWN */
  outcome: Scalars['String']['output'];
  pipeline: Scalars['String']['output'];
  restoredCheckpointId: Maybe<Scalars['Int']['output']>;
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

/** Result of an EXPLAIN statement — returns the plan text and detected format */
export type SqlExplainResult = {
  __typename?: 'SQLExplainResult';
  format: Scalars['String']['output'];
  planText: Scalars['String']['output'];
};

export type SqlFetchResult = {
  __typename?: 'SQLFetchResult';
  columns: Array<SqlColumn>;
  hasMore: Scalars['Boolean']['output'];
  /** Flink job id when this statement launched a job (INSERT / streaming SELECT); null for DDL or bounded batch. */
  jobID: Maybe<Scalars['String']['output']>;
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

/** A single Flink savepoint operation. */
export type Savepoint = {
  __typename?: 'Savepoint';
  /** Trigger-to-completion duration in milliseconds. Null until completed. */
  durationMs: Maybe<Scalars['String']['output']>;
  /** Failure reason. Null unless `status: FAILED`. */
  error: Maybe<Scalars['String']['output']>;
  /** The Flink savepoint operation handle. */
  id: Scalars['String']['output'];
  /** Savepoint storage path. Null until the operation completes successfully. */
  location: Maybe<Scalars['String']['output']>;
  /** Savepoint size in bytes (String to safely encode int64). Null until completed. */
  sizeBytes: Maybe<Scalars['String']['output']>;
  status: SavepointStatus;
  triggerType: SavepointTriggerType;
  /** ISO-millisecond epoch timestamp at which the operation was triggered. */
  triggeredAt: Scalars['String']['output'];
};

/** Lifecycle state of a savepoint operation. */
export type SavepointStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_PROGRESS';

export type SavepointTriggerResult = {
  __typename?: 'SavepointTriggerResult';
  requestId: Scalars['String']['output'];
};

/**
 * How a savepoint was triggered.
 *
 * The server records this when its own mutations initiate a savepoint;
 * savepoints observed in Flink but not initiated by this server default
 * to MANUAL.
 */
export type SavepointTriggerType =
  | 'BLUE_GREEN'
  | 'MANUAL'
  | 'STOP_WITH_SAVEPOINT';

/** The full content of a single schema version. */
export type SchemaDetail = {
  __typename?: 'SchemaDetail';
  id: Scalars['Int']['output'];
  references: Array<SchemaReference>;
  schema: Scalars['String']['output'];
  schemaType: Scalars['String']['output'];
  subject: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

/** A cross-subject reference embedded in a schema. */
export type SchemaReference = {
  __typename?: 'SchemaReference';
  name: Scalars['String']['output'];
  subject: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

/**
 * The registry's global default compatibility level (e.g. BACKWARD, FULL,
 * NONE). Individual subjects may override this — see `SchemaSubject.compatibility`.
 */
export type SchemaRegistryConfig = {
  __typename?: 'SchemaRegistryConfig';
  compatibility: Scalars['String']['output'];
};

/** A subject in the Schema Registry, with metadata about its latest version. */
export type SchemaSubject = {
  __typename?: 'SchemaSubject';
  compatibility: Scalars['String']['output'];
  latestVersion: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  schemaId: Scalars['Int']['output'];
  schemaType: Scalars['String']['output'];
};

export type SimulationInput = {
  cluster: InputMaybe<Scalars['String']['input']>;
  parameters: Scalars['JSON']['input'];
  scenario: Scalars['String']['input'];
  targetJobs: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type SimulationObservation = {
  __typename?: 'SimulationObservation';
  annotation: Maybe<Scalars['String']['output']>;
  metric: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

export type SimulationPreset = {
  __typename?: 'SimulationPreset';
  category: Scalars['String']['output'];
  defaultParameters: Scalars['JSON']['output'];
  description: Scalars['String']['output'];
  name: Scalars['String']['output'];
  scenario: Scalars['String']['output'];
};

export type SimulationRun = {
  __typename?: 'SimulationRun';
  id: Scalars['ID']['output'];
  observations: Array<SimulationObservation>;
  parameters: Scalars['JSON']['output'];
  scenario: Scalars['String']['output'];
  startedAt: Scalars['String']['output'];
  status: SimulationStatus;
  stoppedAt: Maybe<Scalars['String']['output']>;
};

export type SimulationStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'RUNNING';

export type StateManifestInput = {
  fingerprint: Scalars['String']['input'];
  flinkVersion: Scalars['String']['input'];
  operators: Array<OperatorStateInput>;
  pipelineName: Scalars['String']['input'];
  schemaVersion: Scalars['Int']['input'];
};

/** Status of the PostgreSQL historical storage backend. */
export type StorageStatus = {
  __typename?: 'StorageStatus';
  /** Whether the database connection is healthy. */
  connected: Scalars['Boolean']['output'];
  /** Whether storage is enabled in configuration. */
  enabled: Scalars['Boolean']['output'];
  /** Idle connections in the pool. */
  idleConns: Scalars['Int']['output'];
  /** Current migration version applied, empty if none. */
  migrationVersion: Scalars['String']['output'];
  /** Total connections in the pool. */
  totalConns: Scalars['Int']['output'];
};

/** A historical checkpoint record from PostgreSQL. */
export type StoredCheckpoint = {
  __typename?: 'StoredCheckpoint';
  capturedAt: Scalars['String']['output'];
  checkpointID: Scalars['String']['output'];
  checkpointedSize: Maybe<Scalars['String']['output']>;
  cluster: Scalars['String']['output'];
  endToEndDuration: Scalars['String']['output'];
  /** Restore location. Null unless the checkpoint was externally addressable. */
  externalPath: Maybe<Scalars['String']['output']>;
  /** Failure reason. Null unless status is FAILED. */
  failureMessage: Maybe<Scalars['String']['output']>;
  /** Failure time (RFC3339). Null unless status is FAILED. */
  failureTimestamp: Maybe<Scalars['String']['output']>;
  isSavepoint: Scalars['Boolean']['output'];
  jid: Scalars['String']['output'];
  latestAck: Maybe<Scalars['String']['output']>;
  numAckSubtasks: Scalars['Int']['output'];
  numSubtasks: Scalars['Int']['output'];
  persistedData: Scalars['String']['output'];
  processedData: Scalars['String']['output'];
  stateSize: Scalars['String']['output'];
  status: Scalars['String']['output'];
  triggerTimestamp: Maybe<Scalars['String']['output']>;
};

/** A historical exception record from PostgreSQL. */
export type StoredException = {
  __typename?: 'StoredException';
  capturedAt: Scalars['String']['output'];
  cluster: Scalars['String']['output'];
  endpoint: Maybe<Scalars['String']['output']>;
  exceptionName: Scalars['String']['output'];
  id: Scalars['String']['output'];
  jid: Scalars['String']['output'];
  stacktrace: Maybe<Scalars['String']['output']>;
  taskManagerID: Maybe<Scalars['String']['output']>;
  taskName: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /** Emits an AlertInstance whenever a new instance opens. */
  alertFired: AlertInstance;
  /** Emits an AlertInstance whenever an instance transitions to RESOLVED. */
  alertResolved: AlertInstance;
  blueGreenStateChanged: BlueGreenDeployment;
  /**
   * Emits a JobStatusEvent whenever any Flink job's status changes.
   * Optionally scoped to a specific cluster.
   */
  jobStatusChanged: JobStatusEvent;
  /**
   * Emits MetricEvent values at ~1s cadence for the given cluster + metric.
   * When `jobId` is null, the subscription delivers cluster-wide aggregates;
   * when set, it delivers events filtered to that job. `metric` must be one
   * of the v1 supported names — unknown values are rejected as a GraphQL
   * error at subscription time.
   */
  metricStream: MetricEvent;
  /** Streams result batches from a SQL Gateway operation. */
  sqlResults: SqlResultBatch;
};


export type SubscriptionBlueGreenStateChangedArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
  namespace: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionJobStatusChangedArgs = {
  cluster: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionMetricStreamArgs = {
  clusterID: Scalars['String']['input'];
  jobId: InputMaybe<Scalars['ID']['input']>;
  metric: Scalars['String']['input'];
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

/** Preset time range for filtering historical data. */
export type TimeRange =
  | 'LAST_1H'
  | 'LAST_2H'
  | 'LAST_7D'
  | 'LAST_24H'
  | 'LAST_30D';

export type TimestampEntry = {
  __typename?: 'TimestampEntry';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type UpdateAlertRuleInput = {
  condition: AlertConditionInput;
  description: InputMaybe<Scalars['String']['input']>;
  enabled: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
  owner: InputMaybe<Scalars['String']['input']>;
  severity: AlertSeverity;
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

export type AlertConditionFieldsFragment = { __typename?: 'AlertCondition', type: AlertConditionType, threshold: number, windowSec: number | null };

export type AlertRuleFieldsFragment = { __typename?: 'AlertRule', id: string, name: string, description: string, severity: AlertSeverity, owner: string, isPreset: boolean, enabled: boolean, createdAt: string, updatedAt: string, condition: { __typename?: 'AlertCondition', type: AlertConditionType, threshold: number, windowSec: number | null } };

export type AlertInstanceFieldsFragment = { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string };

export type AlertRulesQueryVariables = Exact<{
  enabledOnly: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type AlertRulesQuery = { __typename?: 'Query', alertRules: Array<{ __typename?: 'AlertRule', id: string, name: string, description: string, severity: AlertSeverity, owner: string, isPreset: boolean, enabled: boolean, createdAt: string, updatedAt: string, condition: { __typename?: 'AlertCondition', type: AlertConditionType, threshold: number, windowSec: number | null } }> };

export type ActiveAlertsQueryVariables = Exact<{ [key: string]: never; }>;


export type ActiveAlertsQuery = { __typename?: 'Query', activeAlerts: Array<{ __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string }> };

export type AlertHistoryQueryVariables = Exact<{
  filter: InputMaybe<AlertHistoryFilterInput>;
}>;


export type AlertHistoryQuery = { __typename?: 'Query', alertHistory: { __typename?: 'AlertHistoryPage', total: number, instances: Array<{ __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string }> } };

export type CreateAlertRuleMutationVariables = Exact<{
  input: CreateAlertRuleInput;
}>;


export type CreateAlertRuleMutation = { __typename?: 'Mutation', createAlertRule: { __typename?: 'AlertRule', id: string, name: string, description: string, severity: AlertSeverity, owner: string, isPreset: boolean, enabled: boolean, createdAt: string, updatedAt: string, condition: { __typename?: 'AlertCondition', type: AlertConditionType, threshold: number, windowSec: number | null } } };

export type UpdateAlertRuleMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAlertRuleInput;
}>;


export type UpdateAlertRuleMutation = { __typename?: 'Mutation', updateAlertRule: { __typename?: 'AlertRule', id: string, name: string, description: string, severity: AlertSeverity, owner: string, isPreset: boolean, enabled: boolean, createdAt: string, updatedAt: string, condition: { __typename?: 'AlertCondition', type: AlertConditionType, threshold: number, windowSec: number | null } } };

export type DeleteAlertRuleMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAlertRuleMutation = { __typename?: 'Mutation', deleteAlertRule: { __typename?: 'DeleteResult', success: boolean } };

export type AcknowledgeAlertMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  note: InputMaybe<Scalars['String']['input']>;
}>;


export type AcknowledgeAlertMutation = { __typename?: 'Mutation', acknowledgeAlert: { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string } };

export type SilenceAlertMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type SilenceAlertMutation = { __typename?: 'Mutation', silenceAlert: { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string } };

export type ResolveAlertMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ResolveAlertMutation = { __typename?: 'Mutation', resolveAlert: { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string } };

export type AlertFiredSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type AlertFiredSubscription = { __typename?: 'Subscription', alertFired: { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string } };

export type AlertResolvedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type AlertResolvedSubscription = { __typename?: 'Subscription', alertResolved: { __typename?: 'AlertInstance', id: string, ruleId: string, state: AlertState, dedupKey: string, firedAt: string, lastSeenAt: string, resolvedAt: string | null, currentValue: number | null, message: string, contextJson: string } };

export type CheckpointDetailQueryVariables = Exact<{
  jobId: Scalars['ID']['input'];
  checkpointId: Scalars['String']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CheckpointDetailQuery = { __typename?: 'Query', checkpointDetail: { __typename?: 'CheckpointDetail', id: string, status: string, isSavepoint: boolean, checkpointType: string | null, triggerTimestamp: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, numSubtasks: number, numAcknowledgedSubtasks: number, checkpointedSize: string | null, processedData: string | null, persistedData: string | null, externalPath: string | null, discarded: boolean | null, failureMessage: string | null, failureTimestamp: string | null, tasks: Array<{ __typename?: 'CheckpointTaskDetail', vertexId: string, status: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, numSubtasks: number, numAcknowledgedSubtasks: number, checkpointedSize: string | null, processedData: string | null, persistedData: string | null }> } };

export type CheckpointSubtasksQueryVariables = Exact<{
  jobId: Scalars['ID']['input'];
  checkpointId: Scalars['String']['input'];
  vertexId: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CheckpointSubtasksQuery = { __typename?: 'Query', checkpointSubtasks: { __typename?: 'CheckpointSubtaskStats', vertexId: string, status: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, numSubtasks: number, numAcknowledgedSubtasks: number, summary: { __typename?: 'CheckpointSubtaskSummary', stateSize: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, endToEndDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, syncDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, asyncDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, alignmentDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, startDelay: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null } | null, subtasks: Array<{ __typename?: 'CheckpointSubtaskEntry', index: number, status: string, ackTimestamp: string | null, endToEndDuration: string | null, stateSize: string | null, checkpointedSize: string | null, syncDuration: string | null, asyncDuration: string | null, alignmentBuffered: string | null, alignmentProcessed: string | null, alignmentPersisted: string | null, alignmentDuration: string | null, startDelay: string | null, unalignedCheckpoint: boolean | null, aborted: boolean | null }> } };

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

export type DatabaseSchemasQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
}>;


export type DatabaseSchemasQuery = { __typename?: 'Query', databaseSchemas: Array<{ __typename?: 'DatabaseSchema', name: string, tableCount: number }> };

export type DatabaseTablesQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  schema: Scalars['String']['input'];
}>;


export type DatabaseTablesQuery = { __typename?: 'Query', databaseTables: Array<{ __typename?: 'DatabaseTableSummary', name: string, schema: string, type: string, rowCountEstimate: number }> };

export type DatabaseTableQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  schema: Scalars['String']['input'];
  table: Scalars['String']['input'];
}>;


export type DatabaseTableQuery = { __typename?: 'Query', databaseTable: { __typename?: 'DatabaseTableDetail', name: string, schema: string, columns: Array<{ __typename?: 'DatabaseColumn', name: string, dataType: string, nullable: boolean, defaultValue: string, isPrimaryKey: boolean, comment: string }>, indexes: Array<{ __typename?: 'DatabaseIndex', name: string, columns: Array<string>, unique: boolean, type: string }>, constraints: Array<{ __typename?: 'DatabaseConstraint', name: string, type: string, columns: Array<string>, refTable: string, refColumns: Array<string> }> } };

export type DatabaseQueryHistoryQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
}>;


export type DatabaseQueryHistoryQuery = { __typename?: 'Query', databaseQueryHistory: Array<{ __typename?: 'DatabaseQueryHistoryEntry', sql: string, executedAt: string, executionTimeMs: number, rowCount: number, error: string | null }> };

export type ExecuteDatabaseQueryMutationVariables = Exact<{
  instrument: Scalars['String']['input'];
  sql: Scalars['String']['input'];
}>;


export type ExecuteDatabaseQueryMutation = { __typename?: 'Mutation', executeDatabaseQuery: { __typename?: 'DatabaseQueryResult', rows: Array<Array<Record<string, unknown> | null> | null>, rowCount: number, executionTimeMs: number, truncated: boolean, columns: Array<{ __typename?: 'DatabaseResultColumn', name: string, dataType: string }> } };

export type BlueGreenDeploymentsQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
  namespace: InputMaybe<Scalars['String']['input']>;
}>;


export type BlueGreenDeploymentsQuery = { __typename?: 'Query', blueGreenDeployments: Array<{ __typename?: 'BlueGreenDeployment', name: string, namespace: string, state: BlueGreenState, jobStatus: string | null, error: string | null, lastReconciledTimestamp: string | null, abortTimestamp: string | null, deploymentReadyTimestamp: string | null, blueDeploymentName: string | null, greenDeploymentName: string | null, activeJobId: string | null, pendingJobId: string | null, abortGracePeriod: string | null, deploymentDeletionDelay: string | null }> };

export type BlueGreenDeploymentDetailQueryVariables = Exact<{
  name: Scalars['String']['input'];
  namespace: InputMaybe<Scalars['String']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type BlueGreenDeploymentDetailQuery = { __typename?: 'Query', blueGreenDeployment: { __typename?: 'BlueGreenDeployment', name: string, namespace: string, state: BlueGreenState, jobStatus: string | null, error: string | null, lastReconciledTimestamp: string | null, abortTimestamp: string | null, deploymentReadyTimestamp: string | null, blueDeploymentName: string | null, greenDeploymentName: string | null, activeJobId: string | null, pendingJobId: string | null, abortGracePeriod: string | null, deploymentDeletionDelay: string | null } | null };

export type BlueGreenDeploymentConfigDiffQueryVariables = Exact<{
  name: Scalars['String']['input'];
  namespace: InputMaybe<Scalars['String']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type BlueGreenDeploymentConfigDiffQuery = { __typename?: 'Query', blueGreenDeploymentConfigDiff: { __typename?: 'BlueGreenConfigDiff', blueYAML: string, greenYAML: string } };

export type BlueGreenStateChangedSubscriptionVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
  namespace: InputMaybe<Scalars['String']['input']>;
}>;


export type BlueGreenStateChangedSubscription = { __typename?: 'Subscription', blueGreenStateChanged: { __typename?: 'BlueGreenDeployment', name: string, namespace: string, state: BlueGreenState, jobStatus: string | null, error: string | null } };

export type JobHistoryQueryVariables = Exact<{
  filter: InputMaybe<JobHistoryFilter>;
  pagination: InputMaybe<PaginationInput>;
  orderBy: InputMaybe<OrderByInput>;
}>;


export type JobHistoryQuery = { __typename?: 'Query', jobHistory: { __typename?: 'JobHistoryConnection', edges: Array<{ __typename?: 'JobHistoryEdge', cursor: string, node: { __typename?: 'JobHistoryEntry', jid: string, cluster: string, name: string, state: string, startTime: string | null, endTime: string | null, durationMs: string, tasksTotal: number, tasksRunning: number, tasksFinished: number, tasksCanceled: number, tasksFailed: number, capturedAt: string } }>, pageInfo: { __typename?: 'JobHistoryPageInfo', hasNextPage: boolean, endCursor: string | null, totalCount: number } } };

export type InstrumentsQueryVariables = Exact<{ [key: string]: never; }>;


export type InstrumentsQuery = { __typename?: 'Query', instruments: Array<{ __typename?: 'InstrumentInfo', name: string, displayName: string, type: string, version: string, healthy: boolean, lastHealthCheck: string | null, capabilities: Array<string> }> };

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
  programArgsList: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  parallelism: InputMaybe<Scalars['Int']['input']>;
  savepointPath: InputMaybe<Scalars['String']['input']>;
  allowNonRestoredState: InputMaybe<Scalars['Boolean']['input']>;
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type RunJarMutation = { __typename?: 'Mutation', runJar: { __typename?: 'JarRunResult', jobId: string } };

export type JobManagerDetailQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobManagerDetailQuery = { __typename?: 'Query', jobManager: { __typename?: 'JobManagerDetail', config: Array<{ __typename?: 'JMConfigEntry', key: string, value: string }>, environment: { __typename?: 'JMEnvironment', classpath: Array<string>, jvm: { __typename?: 'JMEnvironmentJVM', version: string, arch: string, options: Array<string> } } | null, metrics: Array<{ __typename?: 'MetricEntry', id: string, value: string }>, haStatus: { __typename?: 'HAStatus', enabled: boolean, mode: string, storageDir: string | null, clusterId: string | null } } };

export type JobManagerStdoutQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobManagerStdoutQuery = { __typename?: 'Query', jobManagerStdout: string };

export type JobManagerStderrQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobManagerStderrQuery = { __typename?: 'Query', jobManagerStderr: string };

export type JobsListQueryVariables = Exact<{
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobsListQuery = { __typename?: 'Query', jobs: Array<{ __typename?: 'JobOverview', id: string, name: string, state: string, startTime: string, endTime: string, duration: string, lastModification: string, recordsInPerSecond: number | null, recordsOutPerSecond: number | null, watermarkLag: number | null, tasks: { __typename?: 'TaskCounts', created: number, scheduled: number, deploying: number, running: number, finished: number, canceling: number, canceled: number, failed: number, reconciling: number, initializing: number } }> };

export type JobDetailQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobDetailQuery = { __typename?: 'Query', job: { __typename?: 'JobDetail', id: string, name: string, state: string, startTime: string, endTime: string, duration: string, now: string, watermarkLag: string | null, vertices: Array<{ __typename?: 'JobVertex', id: string, name: string, maxParallelism: number, parallelism: number, status: string, startTime: string, endTime: string, duration: string, tasks: { __typename?: 'TaskCounts', created: number, scheduled: number, deploying: number, running: number, finished: number, canceling: number, canceled: number, failed: number, reconciling: number, initializing: number }, metrics: { __typename?: 'VertexMetrics', readBytes: string, readBytesComplete: boolean, writeBytes: string, writeBytesComplete: boolean, readRecords: string, readRecordsComplete: boolean, writeRecords: string, writeRecordsComplete: boolean, accumulatedBackpressured: string, accumulatedIdle: string, accumulatedBusy: string } }>, plan: { __typename?: 'JobPlan', jid: string, name: string, type: string, nodes: Array<{ __typename?: 'PlanNode', id: string, parallelism: number, operator: string, operatorStrategy: string, description: string, inputs: Array<{ __typename?: 'PlanNodeInput', num: number, id: string, shipStrategy: string, exchange: string }> | null }> }, exceptions: Array<{ __typename?: 'ExceptionEntry', exceptionName: string, stacktrace: string, timestamp: string, taskName: string | null, endpoint: string | null, taskManagerId: string | null, failureLabels: Array<{ __typename?: 'FailureLabel', key: string, value: string }> | null, concurrentExceptions: Array<{ __typename?: 'ExceptionEntry', exceptionName: string, stacktrace: string, timestamp: string, taskName: string | null, endpoint: string | null, taskManagerId: string | null, failureLabels: Array<{ __typename?: 'FailureLabel', key: string, value: string }> | null }> | null }>, checkpoints: { __typename?: 'CheckpointStats', counts: { __typename?: 'CheckpointCounts', completed: number, inProgress: number, failed: number, total: number, restored: number }, history: Array<{ __typename?: 'CheckpointHistoryEntry', id: string, status: string, isSavepoint: boolean, checkpointType: string | null, triggerTimestamp: string, latestAckTimestamp: string, stateSize: string, endToEndDuration: string, processedData: string, persistedData: string, numSubtasks: number, numAcknowledgedSubtasks: number, checkpointedSize: string | null, externalPath: string | null, failureMessage: string | null, failureTimestamp: string | null }>, summary: { __typename?: 'CheckpointSummary', stateSize: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, endToEndDuration: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null, checkpointedSize: { __typename?: 'CheckpointMinMaxAvg', min: string, max: string, avg: string } | null } | null, latest: { __typename?: 'CheckpointLatest', completed: { __typename?: 'CheckpointHistoryEntry', id: string, status: string, triggerTimestamp: string, stateSize: string, endToEndDuration: string } | null, restored: { __typename?: 'CheckpointRestoredInfo', id: string, restoreTimestamp: string, isSavepoint: boolean, externalPath: string | null } | null } | null } | null, checkpointConfig: { __typename?: 'CheckpointConfig', mode: string, interval: string, timeout: string, minPause: string, maxConcurrent: number, externalizedEnabled: boolean, externalizedDeleteOnCancellation: boolean, unalignedCheckpoints: boolean, stateBackend: string | null, checkpointStorage: string | null, tolerableFailedCheckpoints: number | null, alignedCheckpointTimeout: string | null, checkpointsAfterTasksFinish: boolean | null } | null, restartInfo: { __typename?: 'RestartInfo', numRestarts: number | null, fullRestarts: number | null, restartStrategy: string | null, uptimeMs: string | null, downtimeMs: string | null } | null, vertexDetails: Array<{ __typename?: 'VertexDetail', id: string, name: string, parallelism: number, now: string, subtasks: Array<{ __typename?: 'SubtaskInfo', subtask: number, status: string, attempt: number, endpoint: string, startTime: string, endTime: string, duration: string, taskManagerId: string, metrics: { __typename?: 'VertexMetrics', readBytes: string, readBytesComplete: boolean, writeBytes: string, writeBytesComplete: boolean, readRecords: string, readRecordsComplete: boolean, writeRecords: string, writeRecordsComplete: boolean, accumulatedBackpressured: string, accumulatedIdle: string, accumulatedBusy: string } }> }> | null, watermarks: Array<{ __typename?: 'VertexWatermarks', vertexId: string, watermarks: Array<{ __typename?: 'WatermarkEntry', id: string, value: string }> }> | null, backPressure: Array<{ __typename?: 'VertexBackPressure', vertexId: string, backPressure: { __typename?: 'BackPressureInfo', status: string, backpressureLevel: string, endTimestamp: string, subtasks: Array<{ __typename?: 'SubtaskBackPressure', subtask: number, attemptNumber: number, backpressureLevel: string, ratio: number, busyRatio: number, idleRatio: number }> } }> | null, accumulators: Array<{ __typename?: 'VertexAccumulators', vertexId: string, accumulators: Array<{ __typename?: 'UserAccumulator', name: string, type: string, value: string }> }> | null, metrics: { __typename?: 'JobMetrics', recordsInPerSecond: number, recordsOutPerSecond: number } | null } };

export type CancelJobMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type CancelJobMutation = { __typename?: 'Mutation', cancelJob: { __typename?: 'CancelJobResult', success: boolean } };

export type JobSavepointsQueryVariables = Exact<{
  jobId: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type JobSavepointsQuery = { __typename?: 'Query', savepoints: Array<{ __typename?: 'Savepoint', id: string, status: SavepointStatus, triggerType: SavepointTriggerType, location: string | null, sizeBytes: string | null, durationMs: string | null, triggeredAt: string, error: string | null }> };

export type RedisScanQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  cursor: InputMaybe<Scalars['String']['input']>;
  pattern: InputMaybe<Scalars['String']['input']>;
  count: InputMaybe<Scalars['Int']['input']>;
}>;


export type RedisScanQuery = { __typename?: 'Query', redisScan: { __typename?: 'RedisScanResult', keys: Array<string>, cursor: string, hasMore: boolean } };

export type RedisKeyInfoQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  key: Scalars['String']['input'];
}>;


export type RedisKeyInfoQuery = { __typename?: 'Query', redisKeyInfo: { __typename?: 'RedisKeyInfo', key: string, type: string, ttl: number, encoding: string, memoryUsage: number } };

export type RedisKeyValueQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  key: Scalars['String']['input'];
}>;


export type RedisKeyValueQuery = { __typename?: 'Query', redisKeyValue: { __typename?: 'RedisKeyValue', key: string, type: string, stringValue: string | null, listValue: Array<string> | null, setValue: Array<string> | null, truncated: boolean, totalSize: number, hashValue: Array<{ __typename?: 'RedisHashEntry', field: string, value: string }> | null, zsetValue: Array<{ __typename?: 'RedisZSetEntry', member: string, score: number }> | null } };

export type RedisServerInfoQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
}>;


export type RedisServerInfoQuery = { __typename?: 'Query', redisServerInfo: { __typename?: 'RedisServerInfo', version: string, uptime: number, connectedClients: number, usedMemory: number, totalKeys: number, keyspaceHits: number, keyspaceMisses: number } };

export type RedisMemoryStatsQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
}>;


export type RedisMemoryStatsQuery = { __typename?: 'Query', redisMemoryStats: { __typename?: 'RedisMemoryStats', usedMemory: number, peakMemory: number, rss: number, fragmentationRatio: number, datasetSize: number, overhead: number, allocator: string } };

export type SchemaSubjectsQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
}>;


export type SchemaSubjectsQuery = { __typename?: 'Query', schemaSubjects: Array<{ __typename?: 'SchemaSubject', name: string, latestVersion: number, schemaType: string, schemaId: number, compatibility: string }> };

export type SchemaVersionsQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  subject: Scalars['String']['input'];
}>;


export type SchemaVersionsQuery = { __typename?: 'Query', schemaVersions: Array<number> };

export type SchemaDetailQueryVariables = Exact<{
  instrument: Scalars['String']['input'];
  subject: Scalars['String']['input'];
  version: Scalars['Int']['input'];
}>;


export type SchemaDetailQuery = { __typename?: 'Query', schemaDetail: { __typename?: 'SchemaDetail', subject: string, version: number, id: number, schemaType: string, schema: string, references: Array<{ __typename?: 'SchemaReference', name: string, subject: string, version: number }> } };

export type CheckSchemaCompatibilityMutationVariables = Exact<{
  instrument: Scalars['String']['input'];
  subject: Scalars['String']['input'];
  schema: Scalars['String']['input'];
  schemaType: Scalars['String']['input'];
}>;


export type CheckSchemaCompatibilityMutation = { __typename?: 'Mutation', checkSchemaCompatibility: { __typename?: 'CompatibilityResult', isCompatible: boolean, messages: Array<string> } };

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

export type MetricStreamSubscriptionVariables = Exact<{
  clusterID: Scalars['String']['input'];
  metric: Scalars['String']['input'];
  jobId: InputMaybe<Scalars['ID']['input']>;
}>;


export type MetricStreamSubscription = { __typename?: 'Subscription', metricStream: { __typename?: 'MetricEvent', clusterID: string, jobId: string | null, metric: string, value: number, timestamp: string } };

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

export type TaskManagerStdoutQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type TaskManagerStdoutQuery = { __typename?: 'Query', taskManagerStdout: string };

export type TaskManagerStderrQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  cluster: InputMaybe<Scalars['String']['input']>;
}>;


export type TaskManagerStderrQuery = { __typename?: 'Query', taskManagerStderr: string };
