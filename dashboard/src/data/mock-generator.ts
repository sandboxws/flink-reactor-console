import {
  CHECKPOINT_SEQUENCE,
  fillTemplate,
  JM_LOGGERS,
  JM_THREADS,
  JOB_MANAGER,
  PLACEHOLDER_VALUES,
  pickRandom,
  TASK_MANAGERS,
  TM_LOGGERS,
  TM_THREADS,
} from "@/data/flink-loggers"
import { buildLogEntry } from "@/data/log-parser"
import { generateStackTrace } from "@/data/mock-errors"
import type { LogEntry, LogLevel, LogSource } from "@/data/types"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MockGeneratorConfig {
  /** Min entries per batch (default 1). */
  minBatchSize?: number
  /** Max entries per batch (default 5). */
  maxBatchSize?: number
  /** Min interval between batches in ms (default 500). */
  minIntervalMs?: number
  /** Max interval between batches in ms (default 2000). */
  maxIntervalMs?: number
  /** Approximate seconds between checkpoint sequences (default 30). */
  checkpointIntervalSec?: number
  /** Probability of an exception burst per batch (default 0.03). */
  exceptionBurstProbability?: number
}

const DEFAULTS: Required<MockGeneratorConfig> = {
  minBatchSize: 1,
  maxBatchSize: 5,
  minIntervalMs: 500,
  maxIntervalMs: 2000,
  checkpointIntervalSec: 30,
  exceptionBurstProbability: 0.03,
}

// ---------------------------------------------------------------------------
// Weighted level distribution
// ---------------------------------------------------------------------------

type WeightedLevel = { level: LogLevel; weight: number }

const LEVEL_WEIGHTS: WeightedLevel[] = [
  { level: "INFO", weight: 70 },
  { level: "DEBUG", weight: 15 },
  { level: "WARN", weight: 8 },
  { level: "ERROR", weight: 5 },
  { level: "TRACE", weight: 2 },
]

const TOTAL_WEIGHT = LEVEL_WEIGHTS.reduce((sum, w) => sum + w.weight, 0)

function pickWeightedLevel(): LogLevel {
  let r = Math.random() * TOTAL_WEIGHT
  for (const { level, weight } of LEVEL_WEIGHTS) {
    r -= weight
    if (r <= 0) return level
  }
  return "INFO"
}

// ---------------------------------------------------------------------------
// Single entry generation
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateSingleEntry(now: Date): LogEntry {
  const level = pickWeightedLevel()
  const isJm = Math.random() < 0.3 // ~30% JM, ~70% TM
  const source: LogSource = isJm ? JOB_MANAGER : pickRandom(TASK_MANAGERS)
  const loggers = isJm ? JM_LOGGERS : TM_LOGGERS
  const threads = isJm ? JM_THREADS : TM_THREADS

  const template = pickRandom(loggers)
  const message = fillTemplate(pickRandom(template.messages))
  const thread = pickRandom(threads)

  let stackTrace: string | null = null
  if (level === "ERROR" && Math.random() < 0.7) {
    stackTrace = generateStackTrace().stackTrace
  }

  return buildLogEntry({
    timestamp: now,
    level,
    logger: template.logger,
    thread,
    message,
    source,
    stackTrace,
  })
}

// ---------------------------------------------------------------------------
// Checkpoint sequence generation
// ---------------------------------------------------------------------------

let checkpointCounter = 0

function generateCheckpointSequence(now: Date): LogEntry[] {
  checkpointCounter++
  const cpId = String(checkpointCounter)
  const jobId = pickRandom(PLACEHOLDER_VALUES.JOB_ID)
  const entries: LogEntry[] = []

  // 1. Trigger from JM
  const triggerMsg = CHECKPOINT_SEQUENCE.trigger.message
    .replace(/%CHECKPOINT_ID%/g, cpId)
    .replace(/%TIMESTAMP%/g, String(now.getTime()))
    .replace(/%JOB_ID%/g, jobId)

  entries.push(
    buildLogEntry({
      timestamp: new Date(now.getTime()),
      level: "INFO",
      logger: CHECKPOINT_SEQUENCE.trigger.logger,
      thread: "Checkpoint Timer",
      message: triggerMsg,
      source: JOB_MANAGER,
    }),
  )

  // 2. Acknowledge from each TaskManager (with slight delays)
  for (let i = 0; i < TASK_MANAGERS.length; i++) {
    const tm = TASK_MANAGERS[i]
    const ackTime = new Date(now.getTime() + randomInt(50, 300) * (i + 1))
    const ackMsg = CHECKPOINT_SEQUENCE.acknowledge.message.replace(
      /%CHECKPOINT_ID%/g,
      cpId,
    )

    entries.push(
      buildLogEntry({
        timestamp: ackTime,
        level: "INFO",
        logger: CHECKPOINT_SEQUENCE.acknowledge.logger,
        thread: pickRandom(TM_THREADS),
        message: ackMsg,
        source: tm,
      }),
    )

    // Coordinator receives ack
    const coordAckTime = new Date(ackTime.getTime() + randomInt(10, 50))
    const taskName = pickRandom(PLACEHOLDER_VALUES.TASK_NAME)
    const coordAckMsg = CHECKPOINT_SEQUENCE.coordinatorAck.message
      .replace(/%CHECKPOINT_ID%/g, cpId)
      .replace(/%TASK_NAME%/g, taskName)
      .replace(/%JOB_ID%/g, jobId)
      .replace(/%TM_ID%/g, tm.id)

    entries.push(
      buildLogEntry({
        timestamp: coordAckTime,
        level: "INFO",
        logger: CHECKPOINT_SEQUENCE.coordinatorAck.logger,
        thread: pickRandom(JM_THREADS),
        message: coordAckMsg,
        source: JOB_MANAGER,
      }),
    )
  }

  // 3. Complete or expire (90% complete, 10% expire)
  const completionDelay = randomInt(200, 2000)
  const completionTime = new Date(
    now.getTime() + completionDelay + TASK_MANAGERS.length * 300,
  )

  if (Math.random() < 0.9) {
    const completeMsg = CHECKPOINT_SEQUENCE.complete.message
      .replace(/%CHECKPOINT_ID%/g, cpId)
      .replace(/%JOB_ID%/g, jobId)
      .replace(/%CHECKPOINT_DURATION%/g, String(completionDelay))
      .replace(/%STATE_SIZE%/g, pickRandom(PLACEHOLDER_VALUES.STATE_SIZE))

    entries.push(
      buildLogEntry({
        timestamp: completionTime,
        level: "INFO",
        logger: CHECKPOINT_SEQUENCE.complete.logger,
        thread: pickRandom(JM_THREADS),
        message: completeMsg,
        source: JOB_MANAGER,
      }),
    )
  } else {
    const expireMsg = CHECKPOINT_SEQUENCE.expire.message
      .replace(/%CHECKPOINT_ID%/g, cpId)
      .replace(/%JOB_ID%/g, jobId)
      .replace(/%PENDING_COUNT%/g, pickRandom(PLACEHOLDER_VALUES.PENDING_COUNT))

    entries.push(
      buildLogEntry({
        timestamp: completionTime,
        level: "WARN",
        logger: CHECKPOINT_SEQUENCE.expire.logger,
        thread: pickRandom(JM_THREADS),
        message: expireMsg,
        source: JOB_MANAGER,
      }),
    )
  }

  return entries
}

// ---------------------------------------------------------------------------
// Exception burst generation
// ---------------------------------------------------------------------------

function generateExceptionBurst(now: Date): LogEntry[] {
  const entries: LogEntry[] = []
  const burstSize = randomInt(3, 5)
  const { exceptionClass, message, stackTrace } = generateStackTrace()

  // Pick 1-3 affected TMs
  const affectedCount = Math.min(randomInt(1, 3), TASK_MANAGERS.length)
  const shuffled = [...TASK_MANAGERS].sort(() => Math.random() - 0.5)
  const affectedTms = shuffled.slice(0, affectedCount)

  for (let i = 0; i < burstSize; i++) {
    const tm = affectedTms[i % affectedTms.length]
    const entryTime = new Date(now.getTime() + randomInt(0, 500) * i)

    entries.push(
      buildLogEntry({
        timestamp: entryTime,
        level: "ERROR",
        logger: pickRandom(TM_LOGGERS).logger,
        thread: pickRandom(TM_THREADS),
        message: `${exceptionClass}: ${message}`,
        source: tm,
        stackTrace,
      }),
    )
  }

  return entries
}

// ---------------------------------------------------------------------------
// Streaming generator
// ---------------------------------------------------------------------------

export type OnEntriesCallback = (entries: LogEntry[]) => void

export interface MockGenerator {
  /** Start generating log entries. */
  start(): void
  /** Stop generating log entries. */
  stop(): void
  /** Whether the generator is currently running. */
  isRunning(): boolean
  /** Generate a single batch immediately (for initial data seeding). */
  generateBatch(): LogEntry[]
  /** Update the speed multiplier (1 = normal, 2 = 2x faster, etc). */
  setSpeed(multiplier: number): void
}

/**
 * Create a mock log generator that emits realistic Flink log entries.
 *
 * The generator produces entries via the `onEntries` callback at randomized
 * intervals. It generates checkpoint sequences (~every 30s) and occasional
 * exception bursts alongside normal weighted-level entries.
 */
export function createMockGenerator(
  onEntries: OnEntriesCallback,
  config?: MockGeneratorConfig,
): MockGenerator {
  const cfg = { ...DEFAULTS, ...config }
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let speedMultiplier = 1
  let lastCheckpointTime = Date.now()

  function scheduleNext() {
    if (!running) return

    const interval =
      randomInt(cfg.minIntervalMs, cfg.maxIntervalMs) / speedMultiplier
    timer = setTimeout(() => {
      if (!running) return

      const now = new Date()
      const entries: LogEntry[] = []

      // Check if it's time for a checkpoint sequence
      const sinceLastCheckpoint = (now.getTime() - lastCheckpointTime) / 1000
      if (sinceLastCheckpoint >= cfg.checkpointIntervalSec / speedMultiplier) {
        entries.push(...generateCheckpointSequence(now))
        lastCheckpointTime = now.getTime()
      }
      // Check for exception burst
      else if (Math.random() < cfg.exceptionBurstProbability) {
        entries.push(...generateExceptionBurst(now))
      }
      // Normal entries
      else {
        const batchSize = randomInt(cfg.minBatchSize, cfg.maxBatchSize)
        for (let i = 0; i < batchSize; i++) {
          entries.push(
            generateSingleEntry(
              new Date(now.getTime() + randomInt(0, 200) * i),
            ),
          )
        }
      }

      onEntries(entries)
      scheduleNext()
    }, interval)
  }

  function generateBatch(): LogEntry[] {
    const now = new Date()
    const entries: LogEntry[] = []
    const batchSize = randomInt(cfg.minBatchSize, cfg.maxBatchSize)
    for (let i = 0; i < batchSize; i++) {
      entries.push(
        generateSingleEntry(new Date(now.getTime() + randomInt(0, 200) * i)),
      )
    }
    return entries
  }

  return {
    start() {
      if (running) return
      running = true
      lastCheckpointTime = Date.now()
      scheduleNext()
    },
    stop() {
      running = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
    isRunning() {
      return running
    },
    generateBatch,
    setSpeed(multiplier: number) {
      speedMultiplier = Math.max(0.1, multiplier)
    },
  }
}
