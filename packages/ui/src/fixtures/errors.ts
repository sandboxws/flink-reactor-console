/** Fixture data for job exceptions and grouped error patterns. */

import type { JobException, ErrorGroup, LogEntry } from "../types"
import { createLogEntry } from "./logs"

/** Create a Kafka deserialization exception with stack trace. */
export function createJobException(overrides?: Partial<JobException>): JobException {
  return {
    timestamp: new Date(Date.now() - 300_000),
    name: "java.lang.RuntimeException",
    message: "Failed to deserialize record from Kafka topic",
    stacktrace:
      "java.lang.RuntimeException: Failed to deserialize record\n" +
      "\tat org.apache.flink.connectors.kafka.FlinkKafkaConsumer.deserialize(FlinkKafkaConsumer.java:123)\n" +
      "\tat org.apache.flink.streaming.api.operators.StreamSource.processElement(StreamSource.java:66)\n" +
      "\tat org.apache.flink.streaming.runtime.tasks.SourceStreamTask.run(SourceStreamTask.java:110)",
    taskName: "Source: Kafka [orders]",
    location: "container_123 @ host-01",
    ...overrides,
  }
}

/** Create a grouped error with three occurrences and a sample log entry. */
export function createErrorGroup(overrides?: Partial<ErrorGroup>): ErrorGroup {
  const now = new Date()
  const sample = createLogEntry({
    level: "ERROR",
    message: "java.lang.RuntimeException: Failed to deserialize record",
    stackTrace: "java.lang.RuntimeException: Failed to deserialize record\n\tat ...",
    isException: true,
  })
  return {
    id: `err-${Date.now().toString(36)}`,
    exceptionClass: "java.lang.RuntimeException",
    message: "Failed to deserialize record from Kafka topic",
    count: 3,
    firstSeen: new Date(now.getTime() - 3_600_000),
    lastSeen: now,
    occurrences: [
      new Date(now.getTime() - 3_600_000),
      new Date(now.getTime() - 1_800_000),
      now,
    ],
    sampleEntry: sample,
    affectedSources: [{ type: "taskmanager", id: "tm-0", label: "TM-0" }],
    ...overrides,
  }
}
