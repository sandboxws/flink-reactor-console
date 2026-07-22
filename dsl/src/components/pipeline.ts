import { createElement } from "@/core/jsx-runtime.js"
import type { ConstructNode } from "@/core/types.js"

// ── Pipeline types ──────────────────────────────────────────────────

export type PipelineMode = "streaming" | "batch"

export type StateBackend = "hashmap" | "rocksdb"

export interface CheckpointConfig {
  readonly interval: string
  readonly mode?: "exactly-once" | "at-least-once"
}

export interface RestartStrategy {
  readonly type: "fixed-delay" | "failure-rate" | "no-restart"
  readonly attempts?: number
  readonly delay?: string
}

// ── Blue-green upgrade strategy types ────────────────────────────────

export type UpgradeMode = "stateless" | "savepoint" | "last-state"

export interface BlueGreenConfig {
  readonly abortGracePeriod?: string
  readonly deploymentDeletionDelay?: string
  readonly rescheduleInterval?: string
}

export interface IngressConfig {
  readonly template?: string
  readonly className?: string
  readonly annotations?: Record<string, string>
}

export interface UpgradeStrategy {
  readonly mode: "blue-green"
  readonly upgradeMode?: UpgradeMode
  readonly blueGreen?: BlueGreenConfig
  readonly ingress?: IngressConfig
}

// ── Telemetry types ─────────────────────────────────────────────────

export interface TelemetryConfig {
  /**
   * Identity labels stamped onto the FlinkDeployment metadata and pod
   * template (→ Prometheus kubernetes_sd label discovery) and carried on
   * tap/pipeline manifests for console-side filtering.
   *
   * Validated at synth time (`validateTelemetryLabels`): keys must match
   * `^[a-zA-Z]([a-zA-Z0-9_]*[a-zA-Z0-9])?$` (≤63 chars — the
   * intersection of Prometheus label grammar and Kubernetes label-name
   * rules), values must be empty or
   * `^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$` (≤63 chars), at most
   * 20 labels, and reserved keys (`app`, `component`, `type`,
   * `pipeline`, `environment`) are rejected — the Flink Kubernetes
   * operator owns the first three as pod selector labels.
   */
  readonly labels?: Readonly<Record<string, string>>
}

// ── Resource & memory types ──────────────────────────────────────────

/** Kubernetes pod resource request (mirrors the CRD `resource` shape). */
export interface PodResources {
  /** CPU quantity, e.g. "1" or "500m". */
  readonly cpu?: string
  /** Memory quantity, e.g. "2048m" or "2Gi". */
  readonly memory?: string
}

/**
 * Compute resources for the pipeline's Flink pods. Without this, generated
 * FlinkDeployments default to 1 CPU / 1024m per pod — too small for any
 * stateful RocksDB job, and a direct route to container OOMKills.
 */
export interface PipelineResources {
  readonly taskManager?: PodResources
  readonly jobManager?: PodResources
  /**
   * `taskmanager.memory.managed.fraction` (0..1): the share of Flink memory
   * reserved for managed memory, which the RocksDB state backend draws from.
   * Raise it for large keyed state so RocksDB stays within a bounded budget.
   */
  readonly managedMemoryFraction?: number
}

/**
 * RocksDB state-backend memory tuning (`state.backend.rocksdb.memory.*`).
 * Keeping `managed: true` (the Flink default) bounds RocksDB inside managed
 * memory so it can't grow unbounded into container RSS — the failure mode
 * behind Flink TaskManager OOMKills.
 */
export interface RocksDbConfig {
  /** `state.backend.rocksdb.memory.managed` — bound RocksDB within managed memory. */
  readonly managed?: boolean
  /** `state.backend.rocksdb.memory.write-buffer-ratio` (0..1). */
  readonly writeBufferRatio?: number
  /** `state.backend.rocksdb.memory.high-prio-pool-ratio` (0..1). */
  readonly highPriorityPoolRatio?: number
}

export interface PipelineProps {
  readonly name: string
  readonly mode?: PipelineMode
  readonly parallelism?: number
  readonly checkpoint?: CheckpointConfig
  readonly stateBackend?: StateBackend
  readonly stateTtl?: string
  readonly restartStrategy?: RestartStrategy
  readonly flinkConfig?: Record<string, string>
  readonly upgradeStrategy?: UpgradeStrategy
  readonly telemetry?: TelemetryConfig
  /** Pod compute resources (cpu/memory) + managed-memory fraction. */
  readonly resources?: PipelineResources
  /** RocksDB state-backend memory tuning. */
  readonly rocksdb?: RocksDbConfig
  readonly children?: ConstructNode | ConstructNode[]
}

// ── Validation ──────────────────────────────────────────────────────

const VALID_MODES: ReadonlySet<string> = new Set<PipelineMode>([
  "streaming",
  "batch",
])

const VALID_CHECKPOINT_MODES: ReadonlySet<string> = new Set([
  "exactly-once",
  "at-least-once",
])

/** Warnings emitted during validation (non-fatal) */
export type ValidationWarning = {
  readonly level: "warning"
  readonly message: string
}

/** Collected warnings from the most recent Pipeline validation */
let lastValidationWarnings: ValidationWarning[] = []

/** Retrieve warnings from the most recent Pipeline() call, then clear. */
export function consumeValidationWarnings(): ValidationWarning[] {
  const warnings = lastValidationWarnings
  lastValidationWarnings = []
  return warnings
}

function validatePipelineProps(props: PipelineProps): void {
  lastValidationWarnings = []

  if (props.mode !== undefined && !VALID_MODES.has(props.mode)) {
    throw new Error(
      `Invalid pipeline mode '${props.mode}'. Must be 'streaming' or 'batch'`,
    )
  }

  if (props.checkpoint) {
    if (!props.checkpoint.interval) {
      throw new Error("Checkpoint config requires an interval")
    }
    if (
      props.checkpoint.mode !== undefined &&
      !VALID_CHECKPOINT_MODES.has(props.checkpoint.mode)
    ) {
      throw new Error(
        `Invalid checkpoint mode '${props.checkpoint.mode}'. Must be 'exactly-once' or 'at-least-once'`,
      )
    }
  }

  // Blue-green validation
  if (props.upgradeStrategy?.mode === "blue-green") {
    if (props.mode === "batch") {
      throw new Error(
        "Blue-green upgrade strategy is not supported for batch pipelines. Blue-green requires a long-running streaming job.",
      )
    }

    if (!props.checkpoint) {
      lastValidationWarnings.push({
        level: "warning",
        message:
          "Blue-green upgrade strategy without checkpoint configuration is risky. Stateful blue-green transitions rely on savepoints, which require checkpointing to be enabled.",
      })
    }
  }

  // Resource / memory fractions must be in [0, 1].
  const managedFraction = props.resources?.managedMemoryFraction
  if (
    managedFraction !== undefined &&
    (managedFraction < 0 || managedFraction > 1)
  ) {
    throw new Error(
      `resources.managedMemoryFraction must be between 0 and 1, got ${managedFraction}`,
    )
  }
  if (props.rocksdb) {
    const ratios: readonly [string, number | undefined][] = [
      ["writeBufferRatio", props.rocksdb.writeBufferRatio],
      ["highPriorityPoolRatio", props.rocksdb.highPriorityPoolRatio],
    ]
    for (const [name, value] of ratios) {
      if (value !== undefined && (value < 0 || value > 1)) {
        throw new Error(`rocksdb.${name} must be between 0 and 1, got ${value}`)
      }
    }
  }

  // State-heavy (RocksDB) jobs are the OOMKill risk surface. Nudge toward
  // explicit pod sizing and bounded native memory — non-fatal warnings so
  // prototypes still synth, surfaced by `synth` / `validate` (and the LSP).
  if (props.stateBackend === "rocksdb") {
    if (!props.resources?.taskManager?.memory) {
      lastValidationWarnings.push({
        level: "warning",
        message:
          "RocksDB state backend without an explicit taskManager memory: pods default to 1024m, which is too small for most stateful jobs and a common cause of TaskManager OOMKills. Set resources.taskManager.memory (and consider resources.managedMemoryFraction).",
      })
    }
    if (props.rocksdb?.managed === false) {
      lastValidationWarnings.push({
        level: "warning",
        message:
          "rocksdb.managed = false lets RocksDB allocate native memory outside Flink's managed budget, which can grow into container RSS and trigger OOMKills. Prefer managed: true unless you are explicitly sizing block cache and write buffers.",
      })
    }
  }
}

// ── Pipeline factory ────────────────────────────────────────────────

/**
 * Pipeline component: wraps source, transform, and sink components.
 *
 * Establishes the synthesis scope and records runtime configuration
 * (parallelism, checkpointing, state backend, etc.) on the construct node.
 */
export function Pipeline(props: PipelineProps): ConstructNode {
  validatePipelineProps(props)

  const { children, ...rest } = props
  const childArray =
    children == null ? [] : Array.isArray(children) ? children : [children]

  return createElement("Pipeline", { ...rest }, ...childArray)
}
