import { pickRandom } from "@/data/flink-loggers"

// ---------------------------------------------------------------------------
// Realistic Java/Flink exception class names and messages
// ---------------------------------------------------------------------------

interface ExceptionTemplate {
  className: string
  messages: string[]
}

const FLINK_EXCEPTIONS: ExceptionTemplate[] = [
  {
    className: "org.apache.flink.util.FlinkException",
    messages: [
      "An error occurred while triggering a checkpoint for job.",
      "Task was cancelled.",
      "Could not restore from latest checkpoint.",
      "An error occurred while snapshotting operator state.",
    ],
  },
  {
    className: "org.apache.flink.runtime.checkpoint.CheckpointException",
    messages: [
      "Checkpoint was declined (task was not running).",
      "Checkpoint was expired before completing.",
      "Could not complete snapshot for operator.",
    ],
  },
  {
    className: "java.lang.RuntimeException",
    messages: [
      "Failed to serialize record.",
      "Unexpected error in operator processing.",
      "Error while opening the output format.",
    ],
  },
  {
    className: "java.io.IOException",
    messages: [
      "Connection reset by peer.",
      "Failed to send data to the channel.",
      "Unable to write record to output stream.",
      "Broken pipe.",
    ],
  },
  {
    className: "org.apache.kafka.common.errors.TimeoutException",
    messages: [
      "Expiring 16 record(s) for clicks-0:120000 ms has passed since batch creation.",
      "Failed to update metadata after 60000 ms.",
      "Timeout expired while fetching topic metadata.",
    ],
  },
  {
    className: "java.lang.NullPointerException",
    messages: [
      "Cannot invoke method on null reference.",
      "Attempted to access field of null object.",
    ],
  },
  {
    className:
      "org.apache.flink.streaming.runtime.tasks.ExceptionInChainedOperatorException",
    messages: [
      "Could not forward element to next operator.",
      "Error in chained operator during processing.",
    ],
  },
  {
    className: "java.util.concurrent.TimeoutException",
    messages: [
      "Heartbeat of TaskManager timed out.",
      "Slot request timed out after 300000ms.",
    ],
  },
]

// ---------------------------------------------------------------------------
// Realistic stack trace frame patterns
// ---------------------------------------------------------------------------

const FLINK_FRAMES = {
  serialization: [
    "org.apache.flink.api.common.typeutils.TypeSerializer.serialize(TypeSerializer.java:112)",
    "org.apache.flink.runtime.io.network.api.serialization.RecordSerializer.serialize(RecordSerializer.java:78)",
    "org.apache.flink.api.java.typeutils.runtime.RowSerializer.serialize(RowSerializer.java:95)",
    "org.apache.flink.api.common.typeutils.base.StringSerializer.serialize(StringSerializer.java:42)",
  ],
  checkpoint: [
    "org.apache.flink.runtime.checkpoint.CheckpointCoordinator.triggerCheckpoint(CheckpointCoordinator.java:580)",
    "org.apache.flink.runtime.checkpoint.CheckpointCoordinator.receiveAcknowledgeMessage(CheckpointCoordinator.java:890)",
    "org.apache.flink.streaming.runtime.tasks.StreamTask.performCheckpoint(StreamTask.java:847)",
    "org.apache.flink.streaming.api.operators.AbstractStreamOperator.snapshotState(AbstractStreamOperator.java:404)",
    "org.apache.flink.runtime.state.DefaultOperatorStateBackend.snapshot(DefaultOperatorStateBackend.java:225)",
  ],
  connector: [
    "org.apache.flink.connector.kafka.source.reader.KafkaSourceReader.pollNext(KafkaSourceReader.java:142)",
    "org.apache.flink.connector.kafka.sink.KafkaWriter.write(KafkaWriter.java:187)",
    "org.apache.flink.connector.jdbc.internal.JdbcOutputFormat.writeRecord(JdbcOutputFormat.java:215)",
    "org.apache.kafka.clients.producer.KafkaProducer.send(KafkaProducer.java:938)",
    "org.apache.kafka.clients.consumer.KafkaConsumer.poll(KafkaConsumer.java:1267)",
  ],
  task: [
    "org.apache.flink.streaming.runtime.tasks.StreamTask.processInput(StreamTask.java:508)",
    "org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:204)",
    "org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxStep(StreamTask.java:734)",
    "org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:764)",
    "org.apache.flink.runtime.taskmanager.Task.runWithSystemExitMonitoring(Task.java:952)",
    "org.apache.flink.runtime.taskmanager.Task.restoreAndInvoke(Task.java:931)",
    "org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:745)",
    "org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)",
    "java.lang.Thread.run(Thread.java:829)",
  ],
}

const FRAME_CATEGORIES = Object.keys(
  FLINK_FRAMES,
) as (keyof typeof FLINK_FRAMES)[]

// ---------------------------------------------------------------------------
// "Caused by" inner exception templates
// ---------------------------------------------------------------------------

const CAUSED_BY_EXCEPTIONS: ExceptionTemplate[] = [
  {
    className: "java.io.IOException",
    messages: ["Connection reset", "Stream closed", "Broken pipe"],
  },
  {
    className: "java.lang.IllegalStateException",
    messages: [
      "Operator has been closed.",
      "Buffer pool has been destroyed.",
      "Cannot access state after disposal.",
    ],
  },
  {
    className: "java.lang.OutOfMemoryError",
    messages: [
      "Java heap space",
      "Direct buffer memory",
      "GC overhead limit exceeded",
    ],
  },
  {
    className: "java.net.SocketException",
    messages: ["Connection reset by peer", "Socket closed", "No route to host"],
  },
]

// ---------------------------------------------------------------------------
// Stack trace generation
// ---------------------------------------------------------------------------

function generateFrames(count: number): string[] {
  const frames: string[] = []
  // Start with a context-appropriate category, end with task frames
  const startCategory = pickRandom(FRAME_CATEGORIES.filter((c) => c !== "task"))
  const startFrames = FLINK_FRAMES[startCategory]
  const taskFrames = FLINK_FRAMES.task

  // Pick 1-3 frames from the start category
  const startCount = Math.min(
    Math.floor(Math.random() * 3) + 1,
    startFrames.length,
  )
  for (let i = 0; i < startCount && frames.length < count; i++) {
    frames.push(`\tat ${startFrames[i]}`)
  }

  // Fill remaining with task frames (the common bottom of Flink stacks)
  for (let i = 0; frames.length < count && i < taskFrames.length; i++) {
    frames.push(`\tat ${taskFrames[i]}`)
  }

  return frames
}

function generateCausedByChain(depth: number): string[] {
  const lines: string[] = []

  for (let i = 0; i < depth; i++) {
    const exc = pickRandom(CAUSED_BY_EXCEPTIONS)
    const msg = pickRandom(exc.messages)
    lines.push(`Caused by: ${exc.className}: ${msg}`)

    const frameCount = Math.floor(Math.random() * 3) + 2
    const frames = generateFrames(frameCount)
    lines.push(...frames)

    // Add "... N more" truncation on all but the deepest cause
    if (i < depth - 1) {
      const moreCount = Math.floor(Math.random() * 15) + 5
      lines.push(`\t... ${moreCount} more`)
    }
  }

  return lines
}

/**
 * Generate a realistic Java/Flink stack trace string.
 *
 * Includes the top-level exception, stack frames from Flink internals,
 * "Caused by" chains (1-3 levels), and "... N more" truncation.
 */
export function generateStackTrace(): {
  exceptionClass: string
  message: string
  stackTrace: string
} {
  const exc = pickRandom(FLINK_EXCEPTIONS)
  const message = pickRandom(exc.messages)

  const lines: string[] = []

  // Top-level exception header
  lines.push(`${exc.className}: ${message}`)

  // Main frames (5-9)
  const mainFrameCount = Math.floor(Math.random() * 5) + 5
  lines.push(...generateFrames(mainFrameCount))

  // Caused by chain (1-3 levels deep)
  const chainDepth = Math.floor(Math.random() * 3) + 1
  lines.push(...generateCausedByChain(chainDepth))

  return {
    exceptionClass: exc.className,
    message,
    stackTrace: lines.join("\n"),
  }
}
