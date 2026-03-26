/** Fixture data for log entries with realistic Flink logger names and severity distribution. */

import type { LogEntry, LogLevel, LogSource } from "../types"

/** Sample Flink logger class names used in generated log entries. */
const LOGGERS = [
  "org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint",
  "org.apache.flink.streaming.runtime.tasks.StreamTask",
  "org.apache.flink.connector.kafka.source.KafkaSource",
  "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
  "org.apache.flink.runtime.taskexecutor.TaskExecutor",
]

/** Sample log messages covering deployments, checkpoints, and state operations. */
const MESSAGES = [
  "Received task deployment for Source: Kafka [orders] (1/4)",
  "Checkpoint 142 completed successfully in 1250ms",
  "Switching to epoch 3 for source orders-topic partition 0",
  "Registering task manager container_1234 at host-01:6122",
  "Restoring state from checkpoint 141",
]

/** Available log sources: one job manager and three task managers. */
const SOURCES: LogSource[] = [
  { type: "jobmanager", id: "jm-1", label: "JM" },
  { type: "taskmanager", id: "tm-0", label: "TM-0" },
  { type: "taskmanager", id: "tm-1", label: "TM-1" },
  { type: "taskmanager", id: "tm-2", label: "TM-2" },
]

/** All five log severity levels in ascending order. */
const LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]

/** Create a single log entry with random logger, message, and source. */
export function createLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  const level = overrides?.level ?? "INFO"
  const logger = LOGGERS[Math.floor(Math.random() * LOGGERS.length)]
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    level,
    logger,
    loggerShort: logger.split(".").pop() ?? logger,
    thread: "main",
    message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
    raw: "",
    stackTrace: null,
    isException: level === "ERROR",
    ...overrides,
  }
}

/** Create a batch of log entries with realistic severity distribution (~2% ERROR, ~6% WARN, ~70% INFO). */
export function createLogEntries(count: number): LogEntry[] {
  const now = Date.now()
  const entries: LogEntry[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.random()
    const level: LogLevel =
      r < 0.02 ? "ERROR" : r < 0.08 ? "WARN" : r < 0.25 ? "DEBUG" : r < 0.3 ? "TRACE" : "INFO"
    entries.push(
      createLogEntry({
        timestamp: new Date(now - (count - i) * 500),
        level,
      }),
    )
  }
  return entries
}
