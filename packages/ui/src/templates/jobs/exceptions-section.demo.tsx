"use client"

/**
 * ExceptionsSection demo — renders the exception list
 * with fixture exceptions including a root cause.
 */

import { ExceptionsSection } from "./exceptions-section"
import { createJobException } from "../../fixtures"

/** Standalone demo of the exceptions section with fixture exception data. */
export function ExceptionsSectionDemo() {
  const exceptions = [
    createJobException({
      name: "java.lang.OutOfMemoryError",
      message: "Java heap space",
      stacktrace:
        "java.lang.OutOfMemoryError: Java heap space\n" +
        "\tat java.util.Arrays.copyOf(Arrays.java:3236)\n" +
        "\tat org.apache.flink.runtime.state.heap.HeapKeyedStateBackend.put(HeapKeyedStateBackend.java:182)",
      taskName: "Aggregate: SUM(amount)",
      location: "container_456 @ host-02",
    }),
    createJobException({
      name: "java.lang.RuntimeException",
      message: "Failed to deserialize record from Kafka topic",
      timestamp: new Date(Date.now() - 600_000),
    }),
  ]

  return <ExceptionsSection exceptions={exceptions} />
}
