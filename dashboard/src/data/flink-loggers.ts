/**
 * Flink logger definitions and log message templates for mock data generation.
 *
 * Defines simulated JobManager and TaskManager log sources, thread name pools,
 * logger/message template pairs, checkpoint sequence templates, and placeholder
 * value pools used to produce realistic Flink log output.
 *
 * @module
 */
import type { LogSource } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// Log sources — 1 JobManager + 3 TaskManagers
// ---------------------------------------------------------------------------

/** Simulated JobManager log source. */
export const JOB_MANAGER: LogSource = {
  type: "jobmanager",
  id: "jm-001",
  label: "JobManager",
}

/** Simulated TaskManager log sources (three instances). */
export const TASK_MANAGERS: LogSource[] = [
  { type: "taskmanager", id: "tm-001", label: "TaskManager 1" },
  { type: "taskmanager", id: "tm-002", label: "TaskManager 2" },
  { type: "taskmanager", id: "tm-003", label: "TaskManager 3" },
]

/** All simulated log sources (JobManager + TaskManagers). */
export const ALL_SOURCES: LogSource[] = [JOB_MANAGER, ...TASK_MANAGERS]

// ---------------------------------------------------------------------------
// Thread name patterns
// ---------------------------------------------------------------------------

/** Typical JobManager thread names used in simulated log entries. */
export const JM_THREADS = [
  "flink-akka.actor.default-dispatcher-2",
  "flink-akka.actor.default-dispatcher-4",
  "jobmanager-main",
  "jobmanager-io-0",
  "Checkpoint Timer",
  "flink-rest-server-netty-worker-0",
]

/** Typical TaskManager thread names used in simulated log entries. */
export const TM_THREADS = [
  "flink-akka.actor.default-dispatcher-3",
  "Source: KafkaSource -> Map (1/4)#0",
  "Source: KafkaSource -> Map (2/4)#0",
  "Window(TumblingEventTimeWindows) -> Sink: Print (1/4)#0",
  "Legacy Source Thread - Source: KafkaSource (1/4)#0",
  "Async I/O Thread (1/4)#0",
  "taskmanager-main",
  "taskmanager-io-0",
]

// ---------------------------------------------------------------------------
// JobManager logger names and message templates
// ---------------------------------------------------------------------------

/** A logger class paired with its pool of message templates containing `%PLACEHOLDER%` tokens. */
export interface LoggerTemplate {
  /** Fully-qualified Java logger class name. */
  logger: string
  /** Message templates with `%PLACEHOLDER%` tokens to be filled at generation time. */
  messages: string[]
}

/** JobManager logger/message template pool (Dispatcher, CheckpointCoordinator, JobMaster, ResourceManager). */
export const JM_LOGGERS: LoggerTemplate[] = [
  {
    logger: "org.apache.flink.runtime.dispatcher.StandaloneDispatcher",
    messages: [
      "Received JobGraph submission '%JOB_NAME%' (%JOB_ID%).",
      "Job %JOB_ID% (%JOB_NAME%) switched from state CREATED to RUNNING.",
      "Job %JOB_ID% (%JOB_NAME%) switched from state RUNNING to FINISHED.",
      "Job %JOB_ID% (%JOB_NAME%) switched from state RUNNING to FAILING.",
      "Shutting down cluster with status NORMAL.",
    ],
  },
  {
    logger: "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
    messages: [
      "Triggering checkpoint %CHECKPOINT_ID% (type=CHECKPOINT) @ %TIMESTAMP% for job %JOB_ID%.",
      "Completed checkpoint %CHECKPOINT_ID% for job %JOB_ID% (%CHECKPOINT_DURATION%ms, state size=%STATE_SIZE%).",
      "Checkpoint %CHECKPOINT_ID% of job %JOB_ID% expired before completing. %PENDING_COUNT% pending checkpoint(s) discarded.",
      "Decline checkpoint %CHECKPOINT_ID% by task %TASK_NAME% of job %JOB_ID% at %TM_ID%.",
      "Received acknowledge message for checkpoint %CHECKPOINT_ID% from task %TASK_NAME% of job %JOB_ID% at %TM_ID%.",
    ],
  },
  {
    logger: "org.apache.flink.runtime.jobmaster.JobMaster",
    messages: [
      "Initializing job '%JOB_NAME%' (%JOB_ID%).",
      "Using restart strategy FixedDelayRestartStrategy(maxNumberRestartAttempts=3, delayBetweenRestartAttempts=10000).",
      "Running initialization on master for '%JOB_NAME%' (%JOB_ID%).",
      "Successfully ran initialization on master in 42 ms.",
      "Registering TaskManager with ResourceID %TM_ID% at TaskManager gateway.",
      "Starting execution of source task '%TASK_NAME%'.",
    ],
  },
  {
    logger:
      "org.apache.flink.runtime.resourcemanager.StandaloneResourceManager",
    messages: [
      "Registering TaskManager with ResourceID %TM_ID% (%TM_ADDR%) at ResourceManager.",
      "TaskManager %TM_ID% is registering with effective slots: 4.",
      "Worker %TM_ID% has been removed. Cleaning up all pending slot requests.",
      "Requesting new TaskManager container.",
    ],
  },
]

// ---------------------------------------------------------------------------
// TaskManager logger names and message templates
// ---------------------------------------------------------------------------

/** TaskManager logger/message template pool (TaskExecutor, Task, StreamTask, KafkaSourceReader, KafkaWriter). */
export const TM_LOGGERS: LoggerTemplate[] = [
  {
    logger: "org.apache.flink.runtime.taskexecutor.TaskExecutor",
    messages: [
      "Received task %TASK_NAME% (1/%PARALLELISM%), deploy into slot with allocation id %ALLOC_ID%.",
      "Un-registering task and sending final execution state FINISHED to JobManager for %TASK_NAME% (%TASK_ID%).",
      "Establishing connection to ResourceManager %RM_ADDR%.",
      "Successfully registered at ResourceManager.",
      "Heartbeat of TaskManager %TM_ID% timed out.",
    ],
  },
  {
    logger: "org.apache.flink.runtime.taskmanager.Task",
    messages: [
      "%TASK_NAME% (1/%PARALLELISM%) switched from CREATED to DEPLOYING.",
      "%TASK_NAME% (1/%PARALLELISM%) switched from DEPLOYING to INITIALIZING.",
      "%TASK_NAME% (1/%PARALLELISM%) switched from INITIALIZING to RUNNING.",
      "%TASK_NAME% (1/%PARALLELISM%) switched from RUNNING to FINISHED.",
      "%TASK_NAME% (1/%PARALLELISM%) switched from RUNNING to FAILED. Cause: %EXCEPTION%",
      "%TASK_NAME% (1/%PARALLELISM%) switched from RUNNING to CANCELING.",
    ],
  },
  {
    logger: "org.apache.flink.streaming.runtime.tasks.StreamTask",
    messages: [
      "No data received in the last %IDLE_MS% ms. Idling.",
      "Restoring state from checkpoint %CHECKPOINT_ID%.",
      "Triggering checkpoint %CHECKPOINT_ID% on behalf of the CheckpointCoordinator.",
      "Acknowledging checkpoint %CHECKPOINT_ID%.",
    ],
  },
  {
    logger: "org.apache.flink.connector.kafka.source.reader.KafkaSourceReader",
    messages: [
      "Consumer subtask %SUBTASK_ID% assigned to partitions [%TOPIC%-%PARTITION%].",
      "Consumer subtask %SUBTASK_ID% seeking to offset %OFFSET% for partition %TOPIC%-%PARTITION%.",
      "Consumer subtask %SUBTASK_ID% has no assigned partitions.",
      "Consumer properties: bootstrap.servers=%BOOTSTRAP_SERVERS%, group.id=%GROUP_ID%.",
    ],
  },
  {
    logger: "org.apache.flink.connector.kafka.sink.KafkaWriter",
    messages: [
      "Opening Kafka writer to topic '%TOPIC%' with %PARTITIONS% partitions.",
      "Kafka writer flushed %RECORD_COUNT% records to topic '%TOPIC%'.",
      "Committing transaction for checkpoint %CHECKPOINT_ID%.",
    ],
  },
]

// ---------------------------------------------------------------------------
// Checkpoint sequence templates (emitted as a correlated group)
// ---------------------------------------------------------------------------

/** Ordered checkpoint lifecycle templates emitted as a correlated group (trigger -> ack -> complete/expire). */
export const CHECKPOINT_SEQUENCE = {
  trigger: {
    logger: "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
    message:
      "Triggering checkpoint %CHECKPOINT_ID% (type=CHECKPOINT) @ %TIMESTAMP% for job %JOB_ID%.",
  },
  acknowledge: {
    logger: "org.apache.flink.streaming.runtime.tasks.StreamTask",
    message: "Acknowledging checkpoint %CHECKPOINT_ID%.",
  },
  coordinatorAck: {
    logger: "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
    message:
      "Received acknowledge message for checkpoint %CHECKPOINT_ID% from task %TASK_NAME% of job %JOB_ID% at %TM_ID%.",
  },
  complete: {
    logger: "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
    message:
      "Completed checkpoint %CHECKPOINT_ID% for job %JOB_ID% (%CHECKPOINT_DURATION%ms, state size=%STATE_SIZE%).",
  },
  expire: {
    logger: "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
    message:
      "Checkpoint %CHECKPOINT_ID% of job %JOB_ID% expired before completing. %PENDING_COUNT% pending checkpoint(s) discarded.",
  },
}

// ---------------------------------------------------------------------------
// Placeholder fill values
// ---------------------------------------------------------------------------

/** Pool of realistic replacement values for each `%PLACEHOLDER%` token in log message templates. */
export const PLACEHOLDER_VALUES: Record<string, string[]> = {
  JOB_NAME: [
    "ClickCountJob",
    "FraudDetectionPipeline",
    "ETL-DailyAggregation",
    "SessionWindowAnalytics",
    "OrderEnrichmentStream",
  ],
  JOB_ID: [
    "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1",
  ],
  TASK_NAME: [
    "Source: KafkaSource -> Map",
    "Window(TumblingEventTimeWindows) -> Sink: Print",
    "Filter -> FlatMap -> Sink: Kafka",
    "Source: JdbcSource -> Map -> Sink: Paimon",
    "TemporalJoin -> Aggregate -> Sink: Print",
  ],
  TASK_ID: [
    "c0a80164fda8e5370000000000000001",
    "c0a80164fda8e5370000000000000002",
  ],
  TM_ID: [
    "container_1234567890_0001_01_000001",
    "container_1234567890_0001_01_000002",
    "container_1234567890_0001_01_000003",
  ],
  TM_ADDR: [
    "akka.tcp://flink@tm-1:6122/user/rpc/taskmanager_0",
    "akka.tcp://flink@tm-2:6122/user/rpc/taskmanager_0",
    "akka.tcp://flink@tm-3:6122/user/rpc/taskmanager_0",
  ],
  RM_ADDR: ["akka.tcp://flink@rm:6123/user/rpc/resourcemanager_0"],
  PARALLELISM: ["1", "2", "4", "8"],
  ALLOC_ID: [
    "d5a87f19e7c3f0b2a1e4d3c2b1a0f9e8",
    "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  ],
  CHECKPOINT_ID: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  CHECKPOINT_DURATION: ["342", "1205", "578", "2841", "167"],
  STATE_SIZE: ["1.2 MB", "45.7 MB", "128.3 MB", "3.4 KB", "512.0 MB"],
  PENDING_COUNT: ["1", "2", "3"],
  TIMESTAMP: ["1705312345000"],
  IDLE_MS: ["30000", "60000", "120000"],
  SUBTASK_ID: ["0", "1", "2", "3"],
  TOPIC: ["clicks", "orders", "user-events", "transactions", "page-views"],
  PARTITION: ["0", "1", "2", "3", "4", "5"],
  OFFSET: ["0", "1024", "50782", "100234"],
  BOOTSTRAP_SERVERS: ["kafka-broker-0:9092,kafka-broker-1:9092"],
  GROUP_ID: ["flink-consumer-group-001"],
  RECORD_COUNT: ["128", "256", "512", "1024"],
  PARTITIONS: ["3", "6", "12"],
  EXCEPTION: [
    "java.lang.RuntimeException: Test exception",
    "org.apache.flink.util.FlinkException: An error occurred",
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a random element from an array. */
export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Replace %PLACEHOLDER% tokens with random values from PLACEHOLDER_VALUES. */
export function fillTemplate(template: string): string {
  return template.replace(/%([A-Z_]+)%/g, (_match, key: string) => {
    const values = PLACEHOLDER_VALUES[key]
    return values ? pickRandom(values) : `<${key}>`
  })
}
